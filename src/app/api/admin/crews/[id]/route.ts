import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { encryptText } from "@/lib/encryption";

// ── AWS 환경변수 정제 헬퍼 ────────────────────────────────────
function cleanEnv(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let v = val.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, "");
  return v || undefined;
}

/**
 * PUT /api/admin/crews/[id] - 크루 정보 수정
 * - 수정된 민감 정보는 암호화하여 저장
 * - reissueIvs: true 전달 시 AWS IVS 채널 재발급
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      nickname,
      phone,
      residentRegistrationNumber, // Plain text (마스킹 값이면 스킵)
      bankName,
      accountNumber,              // Plain text (마스킹 값이면 스킵)
      defaultCommissionRate,
      reissueIvs = false,         // true이면 IVS 채널 재발급
    } = body;

    const updateData: Record<string, any> = {};
    if (name) updateData.name = name.trim();
    if (nickname) updateData.nickname = nickname.trim();
    if (phone) updateData.phone = phone.trim();
    if (bankName) updateData.bank_name = bankName.trim();
    if (defaultCommissionRate !== undefined) {
      updateData.default_commission_rate = Number(defaultCommissionRate);
    }

    // 마스킹 처리된 값("*")이 아니면서 새로 입력된 경우에만 암호화하여 갱신
    if (residentRegistrationNumber && !residentRegistrationNumber.includes("*")) {
      updateData.resident_registration_number = encryptText(residentRegistrationNumber.trim());
    }
    if (accountNumber && !accountNumber.includes("*")) {
      updateData.account_number = encryptText(accountNumber.trim());
    }

    // ── IVS 채널 재발급 (reissueIvs: true 요청 시) ──────────
    let ivsAutoCreated = false;
    if (reissueIvs) {
      const awsAccessKeyId  = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
      const awsSecretKey    = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
      const awsSessionToken = cleanEnv(process.env.AWS_SESSION_TOKEN);
      const awsRegion       = cleanEnv(process.env.AWS_REGION) || "ap-northeast-2";

      if (awsAccessKeyId && awsSecretKey) {
        try {
          const { IvsClient, CreateChannelCommand } = await import("@aws-sdk/client-ivs");
          const ivs = new IvsClient({
            region: awsRegion,
            credentials: {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretKey,
              ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
            },
          });

          const safeNickname = (nickname ?? id).replace(/[^a-zA-Z0-9]/g, "-").slice(0, 24);
          const cmd = new CreateChannelCommand({
            name: `crew-${safeNickname}-${Date.now()}`,
            latencyMode: "LOW",
            type: "BASIC",
          });

          const ivsRes = await ivs.send(cmd);
          if (ivsRes.channel && ivsRes.streamKey) {
            updateData.ivs_channel_arn     = ivsRes.channel.arn ?? null;
            updateData.ivs_ingest_endpoint = ivsRes.channel.ingestEndpoint
              ? `rtmps://${ivsRes.channel.ingestEndpoint}/app/`
              : null;
            updateData.ivs_stream_key      = ivsRes.streamKey.value ?? null;
            updateData.ivs_playback_url    = ivsRes.channel.playbackUrl ?? null;
            ivsAutoCreated = true;
            console.log(`[AWS IVS] Crew channel reissued: ${updateData.ivs_channel_arn}`);
          }
        } catch (awsErr: any) {
          console.warn("[AWS IVS] Crew channel reissue failed:", awsErr.message);
          return NextResponse.json(
            { success: false, error: `IVS 채널 재발급 실패: ${awsErr.message}` },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: "AWS 자격 증명이 설정되지 않아 IVS 채널을 발급할 수 없습니다." },
          { status: 500 }
        );
      }
    }

    const admin = createSupabaseAdmin();
    const { data: crew, error } = await admin
      .from("live_crews")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT /api/admin/crews/[id]] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 정보 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: crew, ivsAutoCreated });
  } catch (error) {
    console.error("[PUT /api/admin/crews/[id]]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

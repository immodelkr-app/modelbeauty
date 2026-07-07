import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { encryptText, decryptText, maskResidentNumber, maskAccountNumber } from "@/lib/encryption";

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
 * GET /api/admin/crews - 크루 목록 조회
 * (주민번호, 계좌번호는 마스킹 처리되어 반환)
 * (IVS 채널 정보는 관리자 전용으로 마스킹 없이 반환)
 */
export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data: crews, error } = await admin
      .from("live_crews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/crews] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 목록을 조회할 수 없습니다." }, { status: 500 });
    }

    const maskedCrews = (crews ?? []).map((crew: any) => {
      let rrnPlain = "";
      let accPlain = "";
      try {
        rrnPlain = decryptText(crew.resident_registration_number);
        accPlain = decryptText(crew.account_number);
      } catch (err) {
        console.error("Decryption error:", err);
      }

      return {
        ...crew,
        resident_registration_number: maskResidentNumber(rrnPlain),
        account_number: maskAccountNumber(accPlain),
        // IVS 채널 정보는 마스킹 없이 그대로 반환 (관리자만 접근 가능)
        ivs_channel_arn: crew.ivs_channel_arn ?? null,
        ivs_ingest_endpoint: crew.ivs_ingest_endpoint ?? null,
        ivs_stream_key: crew.ivs_stream_key ?? null,
        ivs_playback_url: crew.ivs_playback_url ?? null,
      };
    });

    return NextResponse.json({ success: true, data: maskedCrews });
  } catch (error) {
    console.error("[GET /api/admin/crews]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/crews - 신규 크루 등록
 * - 주민번호, 계좌번호 AES-256-GCM 암호화 후 저장
 * - AWS IVS 전용 채널 자동 발급 후 크루 레코드에 함께 저장
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      name,
      nickname,
      phone,
      residentRegistrationNumber, // 평문
      bankName,
      accountNumber,              // 평문
      defaultCommissionRate = 0,
    } = body;

    if (!name || !nickname || !phone || !residentRegistrationNumber || !bankName || !accountNumber) {
      return NextResponse.json({ success: false, error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    // 민감 정보 암호화
    const encryptedRRN = encryptText(residentRegistrationNumber.trim());
    const encryptedAcc = encryptText(accountNumber.trim());

    // ── AWS IVS 전용 채널 자동 발급 ────────────────────────────
    let ivsChannelArn: string | null = null;
    let ivsIngestEndpoint: string | null = null;
    let ivsStreamKey: string | null = null;
    let ivsPlaybackUrl: string | null = null;
    let ivsAutoCreated = false;

    const awsAccessKeyId   = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
    const awsSecretKey     = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
    const awsSessionToken  = cleanEnv(process.env.AWS_SESSION_TOKEN);
    const awsRegion        = cleanEnv(process.env.AWS_REGION) || "ap-northeast-2";

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

        // 채널명: crew-{닉네임} (AWS IVS 채널명 규격: 영문/숫자/하이픈/언더스코어)
        const safeNickname = nickname.trim().replace(/[^a-zA-Z0-9]/g, "-").slice(0, 24);
        const channelName = `crew-${safeNickname}-${Date.now()}`;

        const cmd = new CreateChannelCommand({
          name: channelName,
          latencyMode: "LOW",
          type: "BASIC",
        });

        const ivsRes = await ivs.send(cmd);
        if (ivsRes.channel && ivsRes.streamKey) {
          ivsChannelArn     = ivsRes.channel.arn ?? null;
          ivsIngestEndpoint = ivsRes.channel.ingestEndpoint
            ? `rtmps://${ivsRes.channel.ingestEndpoint}/app/`
            : null;
          ivsStreamKey      = ivsRes.streamKey.value ?? null;
          ivsPlaybackUrl    = ivsRes.channel.playbackUrl ?? null;
          ivsAutoCreated    = true;
          console.log(`[AWS IVS] Crew channel created: ${ivsChannelArn}`);
        }
      } catch (awsErr: any) {
        // IVS 채널 발급 실패 → 크루 등록은 계속 진행
        console.warn("[AWS IVS] Crew channel creation failed:", awsErr.message);
      }
    }

    const admin = createSupabaseAdmin();
    const { data: crew, error } = await admin
      .from("live_crews")
      .insert({
        name: name.trim(),
        nickname: nickname.trim(),
        phone: phone.trim(),
        resident_registration_number: encryptedRRN,
        bank_name: bankName.trim(),
        account_number: encryptedAcc,
        default_commission_rate: Number(defaultCommissionRate),
        // IVS 전용 채널 정보 (자동 발급 성공 시 저장)
        ivs_channel_arn:     ivsChannelArn,
        ivs_ingest_endpoint: ivsIngestEndpoint,
        ivs_stream_key:      ivsStreamKey,
        ivs_playback_url:    ivsPlaybackUrl,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/crews] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 등록에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: crew,
      ivsAutoCreated,
      ...(!ivsAutoCreated && {
        ivsWarning:
          "AWS IVS 전용 채널 자동 발급에 실패했습니다. " +
          "Vercel 환경 변수(AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)를 확인하세요. " +
          "크루 수정 화면에서 나중에 재발급할 수 있습니다.",
      }),
    });
  } catch (error) {
    console.error("[POST /api/admin/crews]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

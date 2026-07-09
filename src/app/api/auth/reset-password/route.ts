// ============================================================
// API 라우트: 비밀번호 재설정
// POST /api/auth/reset-password
// ============================================================
// [1단계] nickname + realName + phone → 본인확인 → uid, phoneNumber, nickname, realName 반환
// [2단계] uid + newPassword (+ phoneNumber, nickname, realName) → 비밀번호 변경
//        (만약 Supabase Auth에 계정이 없으면 동일한 uid로 강제 생성)

import { NextRequest, NextResponse } from "next/server";
import { verifyUserIdentity } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── 2단계: 비밀번호 변경 ──────────────────────────────────
    if (body.uid && body.newPassword) {
      const { uid, newPassword, phoneNumber, nickname, realName } = body as {
        uid: string;
        newPassword: string;
        phoneNumber?: string;
        nickname?: string;
        realName?: string;
      };

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json(
          { error: "비밀번호는 6자리 이상이어야 합니다." },
          { status: 400 }
        );
      }

      const adminClient = createSupabaseAdmin();

      // 우선 비밀번호 업데이트를 시도합니다.
      const { error: updateError } = await adminClient.auth.admin.updateUserById(uid, {
        password: newPassword,
      });

      // 만약 유저가 Supabase Auth에 아직 존재하지 않는 경우 (예: MOCA만 가입했던 기존 유저)
      // 에러 메시지가 'User not found' 등으로 오면 직접 동일한 uid로 가입(생성) 처리합니다.
      if (updateError) {
        const isUserNotFound = 
          updateError.message?.toLowerCase().includes("not found") || 
          updateError.status === 404;

        if (isUserNotFound && phoneNumber) {
          const phoneDigits = phoneNumber.replace(/\D/g, "");
          const authEmail = `${phoneDigits}@modelbeauty.kr`;

          console.log(`[reset-password] 유저가 존재하지 않아 신규 생성 진행. uid: ${uid}, email: ${authEmail}`);

          // 기존 app_user_mapping의 local_user_id(uid)와 동일한 ID로 Supabase Auth 유저 강제 생성
          const { error: createError } = await adminClient.auth.admin.createUser({
            id: uid,
            email: authEmail,
            password: newPassword,
            email_confirm: true,
            user_metadata: {
              name: nickname || "가입자",
              real_name: realName || "가입자",
              phone: phoneDigits,
            },
          });

          if (createError) {
            console.error("[POST /api/auth/reset-password] 유저 강제 생성 실패:", createError);
            return NextResponse.json(
              { error: "계정 생성 및 비밀번호 변경에 실패했습니다." },
              { status: 500 }
            );
          }

          return NextResponse.json({ success: true }, { status: 200 });
        }

        console.error("[POST /api/auth/reset-password] 비밀번호 변경 실패:", updateError);
        return NextResponse.json(
          { error: "비밀번호 변경에 실패했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── 1단계: 본인 확인 ─────────────────────────────────────
    const { nickname, realName, phoneNumber } = body as {
      nickname?: string;
      realName?: string;
      phoneNumber?: string;
    };

    if (!nickname?.trim() || !realName?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json(
        { found: false, error: "nickname, realName, phoneNumber는 모두 필수입니다." },
        { status: 400 }
      );
    }

    const phoneDigits = phoneNumber.replace(/\D/g, "");

    // im-core-auth로 본인 확인
    const result = await verifyUserIdentity({
      nickname: nickname.trim(),
      realName: realName.trim(),
      phoneNumber: phoneDigits,
      appName: "MODEL_BEAUTY",
    });

    if (!result) {
      return NextResponse.json(
        { found: false, error: "일치하는 회원 정보를 찾을 수 없습니다." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        found: true,
        uid: result.localUserId,
        phoneNumber: result.phoneNumber || phoneDigits,
        nickname: result.nickname || nickname.trim(),
        realName: result.realName || realName.trim(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

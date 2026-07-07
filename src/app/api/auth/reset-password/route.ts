// ============================================================
// API 라우트: 비밀번호 재설정
// POST /api/auth/reset-password
// ============================================================
// [1단계] nickname + realName + phone → 본인확인 → uid 반환
// [2단계] uid + newPassword → Supabase Admin으로 비밀번호 강제 변경

import { NextRequest, NextResponse } from "next/server";
import { verifyUserIdentity } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── 2단계: 비밀번호 변경 ──────────────────────────────────
    if (body.uid && body.newPassword) {
      const { uid, newPassword } = body as { uid: string; newPassword: string };

      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json(
          { error: "비밀번호는 6자리 이상이어야 합니다." },
          { status: 400 }
        );
      }

      const adminClient = createSupabaseAdmin();
      const { error } = await adminClient.auth.admin.updateUserById(uid, {
        password: newPassword,
      });

      if (error) {
        console.error("[POST /api/auth/reset-password] 비밀번호 변경 실패:", error);
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
      { found: true, uid: result.localUserId },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================
// API 라우트: 닉네임으로 Supabase 가상 이메일 조회
// POST /api/auth/get-auth-email
// ============================================================
// 로그인 시 닉네임을 받아서 im-core-auth에서 휴대폰번호를 조회한 뒤
// Supabase Auth에 사용된 가상 이메일 형식으로 반환

import { NextRequest, NextResponse } from "next/server";
import { getMasterUserByNickname } from "@/lib/core-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname } = body as { nickname?: string };

    if (!nickname?.trim()) {
      return NextResponse.json(
        { found: false, error: "nickname은 필수입니다." },
        { status: 400 }
      );
    }

    // ── 어드민 닉네임 하드코딩 예외 처리 ───────────────────────
    const cleanNickname = nickname.trim();
    if (cleanNickname === "어드민" || cleanNickname === "최고관리자") {
      return NextResponse.json({ found: true, authEmail: "admin@immodel.kr" }, { status: 200 });
    }

    // im-core-auth에서 닉네임 → 마스터유저(휴대폰번호) 조회
    const masterUser = await getMasterUserByNickname(cleanNickname);

    if (!masterUser) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // 가입 시 사용된 가상 이메일 형식 복원
    // 회원가입 시: `${phone_number}@modelbeauty.kr`
    const phoneDigits = masterUser.phoneNumber.replace(/\D/g, "");
    const authEmail = `${phoneDigits}@modelbeauty.kr`;

    return NextResponse.json({ found: true, authEmail }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/auth/get-auth-email]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ found: false, error: message }, { status: 500 });
  }
}

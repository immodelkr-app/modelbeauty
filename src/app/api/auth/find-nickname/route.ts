// ============================================================
// API 라우트: 닉네임 찾기
// POST /api/auth/find-nickname
// ============================================================
// 실명 + 휴대폰번호로 im-core-auth에서 닉네임을 조회

import { NextRequest, NextResponse } from "next/server";
import { findNicknameByRealNameAndPhone } from "@/lib/core-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { realName, phoneNumber } = body as {
      realName?: string;
      phoneNumber?: string;
    };

    if (!realName?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json(
        { found: false, error: "realName과 phoneNumber는 필수입니다." },
        { status: 400 }
      );
    }

    const phoneDigits = phoneNumber.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return NextResponse.json(
        { found: false, error: "올바른 휴대폰 번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const nickname = await findNicknameByRealNameAndPhone(realName.trim(), phoneDigits);

    if (!nickname) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, nickname }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/auth/find-nickname]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json(
      { found: false, error: message },
      { status: 500 }
    );
  }
}

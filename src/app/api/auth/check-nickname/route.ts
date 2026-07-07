// ============================================================
// API 라우트: 닉네임 중복 확인
// GET /api/auth/check-nickname?nickname=xxx
// ============================================================
// im-core-auth에 위임하여 전체 서비스군에서 닉네임 중복을 확인

import { NextRequest, NextResponse } from "next/server";
import { checkNicknameAvailable } from "@/lib/core-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("nickname")?.trim();

    if (!nickname || nickname.length < 2) {
      return NextResponse.json({ available: false }, { status: 400 });
    }

    const available = await checkNicknameAvailable(nickname);
    return NextResponse.json({ available }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/auth/check-nickname]", error);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}

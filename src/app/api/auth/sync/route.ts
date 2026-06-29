// ============================================================
// API 라우트: SSO 동기화 프록시
// POST /api/auth/sync
// ============================================================
// 모델뷰티 앱 로그인 시 im-core-auth와 동기화

import { NextRequest, NextResponse } from "next/server";
import { syncMasterUser } from "@/lib/core-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, localUserId, name } = body;

    if (!phoneNumber || !localUserId) {
      return NextResponse.json(
        { error: "phoneNumber와 localUserId는 필수입니다." },
        { status: 400 }
      );
    }

    const masterUser = await syncMasterUser({
      phoneNumber,
      appName: "MODEL_BEAUTY",
      localUserId,
      name,
    });

    return NextResponse.json({ success: true, ...masterUser });
  } catch (error) {
    console.error("[/api/auth/sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

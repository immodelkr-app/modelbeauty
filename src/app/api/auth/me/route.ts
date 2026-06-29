// ============================================================
// API 라우트: 현재 유저 정보 조회
// GET /api/auth/me
// ============================================================
// Supabase 세션에서 유저 확인 후 im-core-auth 마스터유저 정보 반환

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncMasterUser } from "@/lib/core-auth";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다." }, { status: 401 });
    }

    // 전화번호가 없는 유저는 인증 불가
    if (!user.phone) {
      return NextResponse.json({ error: "전화번호 인증이 필요합니다." }, { status: 401 });
    }

    // im-core-auth에서 마스터유저 동기화 (없으면 생성)
    const masterUser = await syncMasterUser({
      phoneNumber: user.phone,
      appName: "MODEL_BEAUTY",
      localUserId: user.id,
      name: user.user_metadata?.name,
    });

    return NextResponse.json({ success: true, user: masterUser });
  } catch (error) {
    console.error("[/api/auth/me]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

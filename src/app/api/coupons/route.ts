// ============================================================
// API 라우트: 사용 가능한 쿠폰 목록 조회
// GET /api/coupons
// ============================================================
// 로그인한 유저의 masterUserId로 im-core-auth 서버에서 사용 가능한 쿠폰 조회

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailableCoupons } from "@/lib/core-auth";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 전화번호 없는 이메일 전용 계정(어드민 등)은 쿠폰 미지원
    if (!user.phone) {
      return NextResponse.json({ success: true, coupons: [] });
    }

    try {
      // Supabase user id가 im-core-auth의 localUserId이자 masterUserId와 매핑됨
      const coupons = await getAvailableCoupons(user.id);
      return NextResponse.json({ success: true, coupons });
    } catch (coreAuthError) {
      console.warn("[/api/coupons] im-core-auth 연결 불가, 빈 쿠폰 반환:", coreAuthError);
      return NextResponse.json({ success: true, coupons: [], _offline: true });
    }
  } catch (error) {
    console.error("[GET /api/coupons] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

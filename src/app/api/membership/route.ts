// ============================================================
// GET /api/membership — 로그인 회원 본인 등급 조회 (마이페이지용)
// ============================================================
// im-core-auth와 무관하게 모델뷰티 로컬 DB(주문 이력) 기준으로만 계산합니다.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembershipStatus, toTierDto } from "@/lib/membership";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const status = await getMembershipStatus(masterUserId);

    return NextResponse.json({
      success: true,
      data: {
        currentTier: toTierDto(status.tier),
        isLocked: status.isLocked,
        lockReason: status.lockReason,
        lastRecalcAt: null,
        totalPurchasedLast6m: status.totalPurchasedLast6m,
        nextTier: status.nextTier ? toTierDto(status.nextTier) : null,
        amountToNextTier: status.amountToNextTier,
        allTiers: status.allTiers.map(toTierDto),
      },
    });
  } catch (err) {
    console.error("[GET /api/membership]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

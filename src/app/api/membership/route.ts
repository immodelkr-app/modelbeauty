import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/membership — 로그인 회원 본인 등급 조회 (마이페이지용)
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const admin = createSupabaseAdmin();

    // 등급 기준 전체 조회
    const { data: tiers } = await admin
      .from("membership_tiers")
      .select("*")
      .order("sort_order", { ascending: true });

    // 회원 등급 상태
    const { data: membership } = await admin
      .from("user_memberships")
      .select("tier_id, is_locked, last_recalc_at")
      .eq("master_user_id", masterUserId)
      .maybeSingle();

    // 최근 6개월 confirmed 주문 합산
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: orders } = await admin
      .from("orders")
      .select("total_amount")
      .eq("master_user_id", masterUserId)
      .eq("status", "confirmed")
      .gte("created_at", sixMonthsAgo.toISOString());

    const totalPurchasedLast6m = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const currentTierId = membership?.tier_id ?? "normal";
    const sortedTiers = (tiers ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const currentTier = sortedTiers.find((t) => t.id === currentTierId) ?? sortedTiers[0];
    const currentSortOrder = currentTier?.sort_order ?? 1;
    const nextTier = sortedTiers.find((t) => t.sort_order > currentSortOrder) ?? null;

    return NextResponse.json({
      success: true,
      data: {
        currentTier: currentTier ?? { id: "normal", name: "일반", sort_order: 1, min_amount: 0, discount_rate: 0, badge_emoji: "🩶" },
        isLocked: membership?.is_locked ?? false,
        lastRecalcAt: membership?.last_recalc_at ?? null,
        totalPurchasedLast6m,
        nextTier,
        amountToNextTier: nextTier ? Math.max(0, nextTier.min_amount - totalPurchasedLast6m) : 0,
        allTiers: sortedTiers,
      },
    });
  } catch (err) {
    console.error("[GET /api/membership]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

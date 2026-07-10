import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { syncMasterUser } from "@/lib/core-auth";

const ALL_TIERS = [
  { id: "NORMAL", name: "일반", sort_order: 1, min_amount: 0, discount_rate: 0, badge_emoji: "🩶" },
  { id: "SILVER", name: "실버", sort_order: 2, min_amount: 100000, discount_rate: 2, badge_emoji: "🥈" },
  { id: "GOLD", name: "골드", sort_order: 3, min_amount: 300000, discount_rate: 5, badge_emoji: "🥇" },
  { id: "IMODEL", name: "아임모델", sort_order: 4, min_amount: 500000, discount_rate: 8, badge_emoji: "⭐" },
  { id: "VIP", name: "VIP", sort_order: 5, min_amount: 1000000, discount_rate: 10, badge_emoji: "💎" },
];

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

    const userPhone = user.phone || user.user_metadata?.phone || (user.email?.endsWith("@modelbeauty.kr") ? user.email.split("@")[0] : null);
    
    let grade = "NORMAL";
    let isLocked = false;
    
    if (userPhone) {
      try {
        const masterUser = await syncMasterUser({
          phoneNumber: userPhone,
          appName: "MODEL_BEAUTY",
          localUserId: user.id,
          name: user.user_metadata?.name,
        });
        grade = masterUser.grade || "NORMAL";
        isLocked = masterUser.grade_locked || false;
      } catch (err) {
        console.warn("[/api/membership] im-core-auth 연동 실패, 기본값 사용:", err);
      }
    }

    // 최근 6개월 confirmed 주문 합산 (다음 등급 계산용)
    const admin = createSupabaseAdmin();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const { data: orders } = await admin
      .from("orders")
      .select("total_amount")
      .eq("master_user_id", masterUserId)
      .eq("status", "confirmed")
      .gte("created_at", sixMonthsAgo.toISOString());

    const totalPurchasedLast6m = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const matchedGrade = grade.toUpperCase();
    const currentTier = ALL_TIERS.find((t) => t.id === matchedGrade) ?? ALL_TIERS[0];
    const currentSortOrder = currentTier.sort_order;
    const nextTier = ALL_TIERS.find((t) => t.sort_order > currentSortOrder) ?? null;

    // 클라이언트 호환을 위해 id만 소문자로 전송 (기존 'normal', 'silver' 등 뷰 로직 호환)
    const clientCurrentTier = {
      ...currentTier,
      id: currentTier.id.toLowerCase(),
    };
    
    const clientNextTier = nextTier ? {
      ...nextTier,
      id: nextTier.id.toLowerCase(),
    } : null;

    const clientAllTiers = ALL_TIERS.map(t => ({
      ...t,
      id: t.id.toLowerCase()
    }));

    return NextResponse.json({
      success: true,
      data: {
        currentTier: clientCurrentTier,
        isLocked,
        lastRecalcAt: null,
        totalPurchasedLast6m,
        nextTier: clientNextTier,
        amountToNextTier: nextTier ? Math.max(0, nextTier.min_amount - totalPurchasedLast6m) : 0,
        allTiers: clientAllTiers,
      },
    });
  } catch (err) {
    console.error("[GET /api/membership]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

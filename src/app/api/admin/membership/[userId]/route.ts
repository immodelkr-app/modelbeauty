import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getMasterUser, updateMasterUser } from "@/lib/core-auth";

const ALL_TIERS = [
  { id: "NORMAL", name: "일반", sort_order: 1, min_amount: 0, discount_rate: 0, badge_emoji: "🩶" },
  { id: "SILVER", name: "실버", sort_order: 2, min_amount: 100000, discount_rate: 2, badge_emoji: "🥈" },
  { id: "GOLD", name: "골드", sort_order: 3, min_amount: 300000, discount_rate: 5, badge_emoji: "🥇" },
  { id: "IMODEL", name: "아임모델", sort_order: 4, min_amount: 500000, discount_rate: 8, badge_emoji: "⭐" },
  { id: "VIP", name: "VIP", sort_order: 5, min_amount: 1000000, discount_rate: 10, badge_emoji: "💎" },
];

/**
 * GET /api/admin/membership/[userId] — 특정 회원 등급 상세 조회
 * 현재 등급 + 6개월 누적 구매액 + 잠금 상태
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { userId } = await params;

  try {
    const admin = createSupabaseAdmin();

    // 회원 등급 상태 조회 (아임모델 공화국)
    let grade = "NORMAL";
    let isLocked = false;
    let lockReason: string | null = null;

    try {
      const masterUser = await getMasterUser(userId);
      grade = masterUser.grade || "NORMAL";
      isLocked = masterUser.grade_locked || false;
      lockReason = masterUser.grade_locked_reason || null;
    } catch (err) {
      console.warn("[/api/admin/membership/[userId] GET] im-core-auth 조회 실패:", err);
    }

    // 최근 6개월 confirmed 주문 합산
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: orders } = await admin
      .from("orders")
      .select("total_amount")
      .eq("master_user_id", userId)
      .eq("status", "confirmed")
      .gte("created_at", sixMonthsAgo.toISOString());

    const totalPurchased = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

    const currentTier = ALL_TIERS.find((t) => t.id === grade.toUpperCase()) ?? ALL_TIERS[0];
    const currentSortOrder = currentTier.sort_order;
    const nextTier = ALL_TIERS.find((t) => t.sort_order > currentSortOrder) ?? null;

    // 클라이언트 포맷으로 매핑 (소문자 id 변환)
    const clientCurrentTier = { ...currentTier, id: currentTier.id.toLowerCase() };
    const clientNextTier = nextTier ? { ...nextTier, id: nextTier.id.toLowerCase() } : null;
    const clientAllTiers = ALL_TIERS.map(t => ({ ...t, id: t.id.toLowerCase() }));

    return NextResponse.json({
      success: true,
      data: {
        masterUserId: userId,
        currentTier: clientCurrentTier,
        isLocked,
        lockReason,
        lockedAt: null,
        lastRecalcAt: null,
        totalPurchasedLast6m: totalPurchased,
        nextTier: clientNextTier,
        amountToNextTier: nextTier ? Math.max(0, nextTier.min_amount - totalPurchased) : 0,
        allTiers: clientAllTiers,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/membership/[userId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/membership/[userId] — 회원 등급 수동 변경 / 잠금 설정
 * body: { tierId?, isLocked?, lockReason? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { userId } = await params;

  try {
    const body = await request.json();
    const { tierId, isLocked, lockReason } = body;

    const payload: Record<string, any> = {};
    if (tierId !== undefined) {
      payload.grade = tierId.toUpperCase();
    }
    if (isLocked !== undefined) {
      payload.grade_locked = isLocked;
      payload.grade_locked_reason = isLocked ? (lockReason ?? null) : null;
    }

    // 아임모델 공화국 API 연동 수동 업데이트
    const updatedUser = await updateMasterUser(userId, payload);

    return NextResponse.json({ 
      success: true, 
      data: {
        master_user_id: updatedUser.masterUserId,
        tier_id: (updatedUser.grade || "NORMAL").toLowerCase(),
        is_locked: updatedUser.grade_locked ?? false,
        lock_reason: updatedUser.grade_locked_reason ?? null,
      } 
    });
  } catch (err) {
    console.error("[PUT /api/admin/membership/[userId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

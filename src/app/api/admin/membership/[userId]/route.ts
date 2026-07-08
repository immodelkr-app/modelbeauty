import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

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

    // 등급 기준 전체 조회
    const { data: tiers } = await admin
      .from("membership_tiers")
      .select("*")
      .order("sort_order", { ascending: true });

    // 회원 등급 상태 조회 (없으면 일반 등급)
    const { data: membership } = await admin
      .from("user_memberships")
      .select("*")
      .eq("master_user_id", userId)
      .maybeSingle();

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

    const currentTierId = membership?.tier_id ?? "normal";
    const currentTier = (tiers ?? []).find((t) => t.id === currentTierId);

    // 다음 등급 계산
    const sortedTiers = (tiers ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const currentSortOrder = currentTier?.sort_order ?? 1;
    const nextTier = sortedTiers.find((t) => t.sort_order > currentSortOrder) ?? null;

    return NextResponse.json({
      success: true,
      data: {
        masterUserId: userId,
        currentTier: currentTier ?? { id: "normal", name: "일반", sort_order: 1, min_amount: 0, discount_rate: 0, badge_emoji: "🩶" },
        isLocked: membership?.is_locked ?? false,
        lockReason: membership?.lock_reason ?? null,
        lockedAt: membership?.locked_at ?? null,
        lastRecalcAt: membership?.last_recalc_at ?? null,
        totalPurchasedLast6m: totalPurchased,
        nextTier,
        amountToNextTier: nextTier ? Math.max(0, nextTier.min_amount - totalPurchased) : 0,
        allTiers: tiers ?? [],
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

    const admin = createSupabaseAdmin();

    const updateData: Record<string, unknown> = {};
    if (tierId !== undefined) updateData.tier_id = tierId;
    if (isLocked !== undefined) {
      updateData.is_locked = isLocked;
      if (isLocked) {
        updateData.locked_at = new Date().toISOString();
        updateData.lock_reason = lockReason ?? null;
      } else {
        updateData.locked_at = null;
        updateData.lock_reason = null;
        updateData.locked_by = null;
      }
    }

    // upsert: 처음 등급 지정 시 레코드 생성
    const { data, error } = await admin
      .from("user_memberships")
      .upsert({
        master_user_id: userId,
        tier_id: tierId ?? "normal",
        ...updateData,
      }, { onConflict: "master_user_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[PUT /api/admin/membership/[userId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

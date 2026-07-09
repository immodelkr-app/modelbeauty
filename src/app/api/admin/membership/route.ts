import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/membership — 등급 정의 목록 조회
 */
export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("membership_tiers")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/membership]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/membership — 등급별 기준금액/할인율 수정
 * body: [{ id, minAmount, discountRate, name, badgeEmoji }]
 */
export async function PUT(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const tiers: { id: string; minAmount?: number; discountRate?: number; name?: string; badgeEmoji?: string }[] = body.tiers ?? [];

    const admin = createSupabaseAdmin();

    for (const t of tiers) {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (t.minAmount !== undefined) updateData.min_amount = t.minAmount;
      if (t.discountRate !== undefined) updateData.discount_rate = t.discountRate;
      if (t.name !== undefined) updateData.name = t.name;
      if (t.badgeEmoji !== undefined) updateData.badge_emoji = t.badgeEmoji;

      const { error } = await admin
        .from("membership_tiers")
        .update(updateData)
        .eq("id", t.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/admin/membership]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/membership/recalculate — 전체 회원 등급 일괄 재산정
 * 1월/7월 재산정 시 관리자가 클릭
 */
export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();

    // 1. 등급 기준 조회
    const { data: tiers, error: tiersErr } = await admin
      .from("membership_tiers")
      .select("id, min_amount, sort_order")
      .order("sort_order", { ascending: false }); // 높은 등급부터

    if (tiersErr || !tiers) throw tiersErr;

    // 2. 잠금되지 않은 전체 회원 목록 (user_memberships)
    const { data: memberships, error: membErr } = await admin
      .from("user_memberships")
      .select("master_user_id, tier_id, is_locked")
      .eq("is_locked", false);

    if (membErr) throw membErr;

    // 3. 재산정 기간: 최근 6개월
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let upgraded = 0;
    let downgraded = 0;
    let unchanged = 0;

    for (const membership of memberships ?? []) {
      // 해당 회원의 최근 6개월 confirmed 주문 합산
      const { data: orders } = await admin
        .from("orders")
        .select("total_amount")
        .eq("master_user_id", membership.master_user_id)
        .eq("status", "confirmed")
        .gte("created_at", sixMonthsAgo.toISOString());

      const totalPurchased = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

      // 해당 누적 구매액에 맞는 가장 높은 등급 결정
      let newTierId = "normal";
      for (const tier of tiers) {
        if (totalPurchased >= tier.min_amount) {
          newTierId = tier.id;
          break;
        }
      }

      // 등급 변경 업데이트
      if (newTierId !== membership.tier_id) {
        const { sort_order: newSort } = tiers.find((t) => t.id === newTierId)!;
        const { sort_order: oldSort } = tiers.find((t) => t.id === membership.tier_id) ?? { sort_order: 1 };
        if (newSort > oldSort) upgraded++;
        else downgraded++;
      } else {
        unchanged++;
      }

      await admin
        .from("user_memberships")
        .update({ tier_id: newTierId, last_recalc_at: now.toISOString() })
        .eq("master_user_id", membership.master_user_id);
    }

    return NextResponse.json({
      success: true,
      result: {
        total: (memberships ?? []).length,
        upgraded,
        downgraded,
        unchanged,
        recalcAt: now.toISOString(),
      },
    });
  } catch (err) {
    console.error("[POST /api/admin/membership/recalculate]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

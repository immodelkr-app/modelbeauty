import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { recalculateAllMemberships } from "@/lib/membership";

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
 * POST /api/admin/membership — 전체 회원 등급 일괄 재산정
 * 1월/7월 재산정 시 관리자가 클릭. 모델뷰티 로컬 주문 이력만 기준으로 계산하며
 * im-core-auth와는 무관합니다 (grade_locked가 아니라 로컬 user_memberships.is_locked로 잠금 판정).
 */
export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const result = await recalculateAllMemberships();
    return NextResponse.json({
      success: true,
      result: { ...result, recalcAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[POST /api/admin/membership/recalculate]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}


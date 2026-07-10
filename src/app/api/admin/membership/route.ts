import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getAllMasterUsers, updateMasterUser } from "@/lib/core-auth";

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

    // 2. 아임모델 공화국에서 전체 회원 가져오기
    let masterUsers = [];
    try {
      masterUsers = await getAllMasterUsers();
    } catch (err) {
      console.error("[POST /api/admin/membership/recalculate] 전체 회원 목록 로드 실패:", err);
      return NextResponse.json({ success: false, error: "통합 회원 목록 로드 실패" }, { status: 500 });
    }

    // 등급 자동 갱신 잠금(grade_locked)이 false인 회원만 필터링
    const targetUsers = masterUsers.filter(u => !u.grade_locked);

    // 3. 재산정 기간: 최근 6개월
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let upgraded = 0;
    let downgraded = 0;
    let unchanged = 0;

    for (const user of targetUsers) {
      // 해당 회원의 최근 6개월 confirmed 주문 합산
      const { data: orders } = await admin
        .from("orders")
        .select("total_amount")
        .eq("master_user_id", user.id)
        .eq("status", "confirmed")
        .gte("created_at", sixMonthsAgo.toISOString());

      const totalPurchased = (orders ?? []).reduce((s, o) => s + (o.total_amount ?? 0), 0);

      // 해당 누적 구매액에 맞는 가장 높은 등급 결정
      let newGrade = "NORMAL";
      for (const tier of tiers) {
        const tierCode = tier.id.toUpperCase();
        if (totalPurchased >= tier.min_amount) {
          newGrade = tierCode;
          break;
        }
      }

      const currentGrade = (user.grade || "NORMAL").toUpperCase();

      // 등급 변경 업데이트
      if (newGrade !== currentGrade) {
        const { sort_order: newSort } = tiers.find((t) => t.id.toUpperCase() === newGrade) ?? { sort_order: 1 };
        const { sort_order: oldSort } = tiers.find((t) => t.id.toUpperCase() === currentGrade) ?? { sort_order: 1 };
        if (newSort > oldSort) upgraded++;
        else downgraded++;

        // 아임모델 공화국 API 연동
        try {
          await updateMasterUser(user.id, { grade: newGrade });
        } catch (updateErr) {
          console.error(`[POST /api/admin/membership/recalculate] 유저 ${user.id} 등급 변경 실패:`, updateErr);
        }
      } else {
        unchanged++;
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        total: targetUsers.length,
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


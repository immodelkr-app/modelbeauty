// ============================================================
// POST /api/admin/trial-reviews/[id]/points — 체험 후기 작성자에게 포인트 수동 지급
// body: { amount: number, description?: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { rewardPoints } from "@/lib/core-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const amount = Number(body.amount);
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "지급할 포인트는 1 이상의 정수여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: review, error: reviewError } = await admin
      .from("trial_reviews")
      .select("id, master_user_id, points_granted, title")
      .eq("id", id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ success: false, error: "체험 후기를 찾을 수 없습니다." }, { status: 404 });
    }

    const result = await rewardPoints({
      masterUserId: review.master_user_id,
      amount,
      description: `[체험 후기 포인트] ${review.title}${description ? ` - ${description}` : ""}`,
    });

    const { data: updated, error: updateError } = await admin
      .from("trial_reviews")
      .update({
        points_granted: (review.points_granted ?? 0) + amount,
        points_granted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updated, newBalance: result.newBalance });
  } catch (err) {
    console.error("[POST /api/admin/trial-reviews/[id]/points]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "포인트 지급 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

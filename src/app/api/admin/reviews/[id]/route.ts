import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/reviews/[id] — 리뷰 숨김/노출 처리
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const isHidden = Boolean(body.isHidden);
    const hiddenReason = isHidden ? (body.hiddenReason?.trim() || null) : null;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("product_reviews")
      .update({ is_hidden: isHidden, hidden_reason: hiddenReason })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[PATCH /api/admin/reviews/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/reviews/[id] — 리뷰 완전 삭제 (스팸 등)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("product_reviews").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/reviews/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/live/[id]/deal — 방송 내 상품의 "라이브 특가" 표시 제어 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { productId, isLiveDeal, dealEndsAt } = body;

    if (!productId) {
      return Response.json({ success: false, error: "productId가 필요합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const updatePayload: Record<string, unknown> = {};
    if (isLiveDeal !== undefined) updatePayload.is_live_deal = isLiveDeal;
    if (dealEndsAt !== undefined) updatePayload.deal_ends_at = dealEndsAt || null;

    const { error } = await admin
      .from("live_stream_products")
      .update(updatePayload)
      .eq("stream_id", id)
      .eq("product_id", productId);

    if (error) throw error;

    return Response.json({ success: true, message: "라이브 특가 설정 변경 완료" });
  } catch (err: any) {
    console.error("[PATCH /api/live/[id]/deal] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

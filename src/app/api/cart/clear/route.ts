// ============================================================
// DELETE /api/cart/clear — 장바구니 전체 비우기
// 주문 완료 후 서버에서 호출
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (user?.user_metadata?.master_user_id as string) ?? null;
}

export async function DELETE() {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdmin();

    const { error } = await admin
      .from("cart_items")
      .delete()
      .eq("master_user_id", masterUserId);

    if (error) throw error;

    return Response.json({
      success: true,
      message: "장바구니가 비워졌습니다.",
    });
  } catch (err) {
    console.error("[DELETE /api/cart/clear]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

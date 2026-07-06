// ============================================================
// PATCH  /api/cart/[id]  — 수량 변경
// DELETE /api/cart/[id]  — 항목 삭제
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // master_user_id가 없으면 user.id로 폴백
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { quantity } = body;

    if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
      return Response.json(
        { success: false, error: "수량은 1 이상의 정수여야 합니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // master_user_id 검증 (본인 항목인지 확인)
    const { data: item } = await admin
      .from("cart_items")
      .select("id, master_user_id")
      .eq("id", id)
      .single();

    if (!item || item.master_user_id !== masterUserId) {
      return Response.json(
        { success: false, error: "장바구니 항목을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from("cart_items")
      .update({ quantity })
      .eq("id", id)
      .select("id, quantity")
      .single();

    if (error) throw error;

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[PATCH /api/cart/[id]]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const admin = createSupabaseAdmin();

    // 본인 항목인지 확인 후 삭제
    const { error } = await admin
      .from("cart_items")
      .delete()
      .eq("id", id)
      .eq("master_user_id", masterUserId);

    if (error) throw error;

    return Response.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    console.error("[DELETE /api/cart/[id]]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

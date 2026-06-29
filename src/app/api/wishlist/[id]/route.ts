// ============================================================
// DELETE /api/wishlist/[id] — 위시리스트에서 제거
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (user?.user_metadata?.master_user_id as string) ?? null;
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

    const { error } = await admin
      .from("wishlist_items")
      .delete()
      .eq("id", id)
      .eq("master_user_id", masterUserId);

    if (error) throw error;

    return Response.json({ success: true, message: "위시리스트에서 제거되었습니다." });
  } catch (err) {
    console.error("[DELETE /api/wishlist/[id]]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/mypage/orders/[id] — 주문 상세
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (user?.user_metadata?.master_user_id as string) ?? null;
}

export async function GET(
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

    const { data, error } = await admin
      .from("orders")
      .select(
        `*,
         order_items (
           id, product_name, variant_info, unit_price, quantity, subtotal,
           products ( id, name, slug, images )
         ),
         shipping_info ( * ),
         refund_requests ( * )`
      )
      .eq("id", id)
      .eq("master_user_id", masterUserId)
      .single();

    if (error || !data) {
      return Response.json(
        { success: false, error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[GET /api/mypage/orders/[id]]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

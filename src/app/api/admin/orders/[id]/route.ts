// ============================================================
// GET   /api/admin/orders/[id] — 주문 상세
// PATCH /api/admin/orders/[id] — 주문 상태 변경
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const VALID_STATUSES = [
  "pending", "paid", "preparing", "shipping",
  "delivered", "confirmed", "cancelled",
  "refund_requested", "refunded",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("orders")
      .select(`*, order_items ( *, products ( id, name, slug, images ) ), shipping_info ( * )`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return Response.json({ success: false, error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[GET /api/admin/orders/[id]]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, note } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return Response.json(
        { success: false, error: "유효하지 않은 주문 상태입니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // 현재 상태 조회
    const { data: current } = await admin
      .from("orders")
      .select("status")
      .eq("id", id)
      .single();

    // 주문 상태 업데이트
    const { data, error } = await admin
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    if (error) throw error;

    // 상태 이력 기록
    await admin.from("order_status_history").insert({
      order_id: id,
      from_status: current?.status ?? null,
      to_status: status,
      changed_by: "admin",
      note: note ?? null,
    });

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[PATCH /api/admin/orders/[id]]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

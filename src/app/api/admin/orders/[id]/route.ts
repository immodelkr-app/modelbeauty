// ============================================================
// GET   /api/admin/orders/[id] — 주문 상세
// PATCH /api/admin/orders/[id] — 주문 상태 변경
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { rewardPoints, restoreCoupon } from "@/lib/core-auth";

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

    // ── im-core-auth 연동 (포인트 적립 및 복원, 쿠폰 복원) ──────────────────
    if (data) {
      const orderId = data.id;

      // 1. 구매 확정 (confirmed) -> 포인트 적립 (결제액의 1%)
      if (status === "confirmed" && current?.status !== "confirmed") {
        const { data: order } = await admin
          .from("orders")
          .select("master_user_id, total_amount, order_number")
          .eq("id", orderId)
          .single();

        if (order && order.total_amount > 0) {
          const rewardAmount = Math.floor(order.total_amount * 0.01); // 1% 적립
          if (rewardAmount > 0) {
            try {
              await rewardPoints({
                masterUserId: order.master_user_id,
                amount: rewardAmount,
                description: `구매 확정 포인트 적립 (${order.order_number})`,
              });
            } catch (err) {
              console.error("[PATCH /api/admin/orders/[id]] 포인트 적립 실패:", err);
            }
          }
        }
      }

      // 2. 주문 취소 또는 환불 완료 (cancelled / refunded) -> 포인트 반환 및 쿠폰 복원
      if (
        (status === "cancelled" || status === "refunded") &&
        current?.status !== "cancelled" &&
        current?.status !== "refunded"
      ) {
        const { data: order } = await admin
          .from("orders")
          .select("master_user_id, order_number, used_point_amount, used_coupon_id")
          .eq("id", orderId)
          .single();

        if (order) {
          // 포인트 반환
          if (order.used_point_amount > 0) {
            try {
              await rewardPoints({
                masterUserId: order.master_user_id,
                amount: order.used_point_amount,
                description: `주문 취소/환불 포인트 반환 (${order.order_number})`,
              });
            } catch (err) {
              console.error("[PATCH /api/admin/orders/[id]] 포인트 환불 실패:", err);
            }
          }

          // 쿠폰 복원
          if (order.used_coupon_id) {
            try {
              await restoreCoupon(order.used_coupon_id);
            } catch (err) {
              console.error("[PATCH /api/admin/orders/[id]] 쿠폰 복원 실패:", err);
            }
          }
        }
      }
    }

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

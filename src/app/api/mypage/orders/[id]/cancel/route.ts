// ============================================================
// POST /api/mypage/orders/[id]/cancel — 주문 취소 (마이페이지)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { rewardPoints, restoreCoupon } from "@/lib/core-auth";

const CANCELLABLE_STATUSES = ["pending", "paid"];

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function POST(
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

    const { data: order, error: fetchError } = await admin
      .from("orders")
      .select("id, status, order_number, master_user_id, used_point_amount, used_coupon_id")
      .eq("id", id)
      .eq("master_user_id", masterUserId)
      .single();

    if (fetchError || !order) {
      return Response.json(
        { success: false, error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return Response.json(
        { success: false, error: "취소할 수 없는 주문 상태입니다." },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    if (error) throw error;

    // 포인트 반환
    if (order.used_point_amount > 0) {
      try {
        await rewardPoints({
          masterUserId: order.master_user_id,
          amount: order.used_point_amount,
          description: `주문 취소 포인트 반환 (${order.order_number})`,
        });
      } catch (err) {
        console.error("[POST /api/mypage/orders/[id]/cancel] 포인트 환불 실패:", err);
      }
    }

    // 쿠폰 복원
    if (order.used_coupon_id) {
      try {
        await restoreCoupon(order.used_coupon_id);
      } catch (err) {
        console.error("[POST /api/mypage/orders/[id]/cancel] 쿠폰 복원 실패:", err);
      }
    }

    // 상태 이력 기록
    await admin.from("order_status_history").insert({
      order_id: id,
      from_status: order.status,
      to_status: "cancelled",
      changed_by: "user",
      note: "고객 주문 취소",
    });

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[POST /api/mypage/orders/[id]/cancel]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

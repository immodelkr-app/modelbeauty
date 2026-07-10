import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { rewardPoints, restoreCoupon } from "@/lib/core-auth";

const VALID_STATUSES = [
  "pending", "paid", "preparing", "shipping",
  "delivered", "confirmed", "cancelled",
  "refund_requested", "refunded",
];

export async function PATCH(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { orderIds, status, note } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return Response.json(
        { success: false, error: "변경할 주문 ID 목록이 필요합니다." },
        { status: 400 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return Response.json(
        { success: false, error: "유효하지 않은 주문 상태입니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    let updatedCount = 0;
    const errors: string[] = [];

    // 각 주문별 상태 변경 및 비즈니스 로직(아임모델 공화국 연동 포함) 순차 처리
    for (const id of orderIds) {
      try {
        // 현재 상태 조회
        const { data: current, error: fetchErr } = await admin
          .from("orders")
          .select("status, master_user_id, total_amount, order_number, used_point_amount, used_coupon_id")
          .eq("id", id)
          .single();

        if (fetchErr || !current) {
          errors.push(`주문 ID ${id}를 찾을 수 없습니다.`);
          continue;
        }

        if (current.status === status) {
          // 이미 해당 상태이면 변경 생략
          continue;
        }

        // 주문 상태 업데이트
        const { error: updateErr } = await admin
          .from("orders")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id);

        if (updateErr) {
          errors.push(`주문 ID ${id} 업데이트 실패: ${updateErr.message}`);
          continue;
        }

        // ── 아임모델 공화국 연동 (포인트/쿠폰 처리) ──
        
        // 1. 구매 확정 (confirmed) -> 포인트 적립 (1%)
        if (status === "confirmed" && current.status !== "confirmed") {
          if (current.total_amount > 0) {
            const rewardAmount = Math.floor(current.total_amount * 0.01);
            if (rewardAmount > 0) {
              try {
                await rewardPoints({
                  masterUserId: current.master_user_id,
                  amount: rewardAmount,
                  description: `구매 확정 포인트 적립 (${current.order_number})`,
                });
              } catch (err) {
                console.error(`[bulk-status] 주문 ${current.order_number} 포인트 적립 실패:`, err);
              }
            }
          }
        }

        // 2. 주문 취소 또는 환불 완료 (cancelled / refunded) -> 포인트 반환 및 쿠폰 복원
        if (
          (status === "cancelled" || status === "refunded") &&
          current.status !== "cancelled" &&
          current.status !== "refunded"
        ) {
          // 포인트 반환
          if (current.used_point_amount > 0) {
            try {
              await rewardPoints({
                masterUserId: current.master_user_id,
                amount: current.used_point_amount,
                description: `주문 취소/환불 포인트 반환 (${current.order_number})`,
              });
            } catch (err) {
              console.error(`[bulk-status] 주문 ${current.order_number} 포인트 반환 실패:`, err);
            }
          }

          // 쿠폰 복원
          if (current.used_coupon_id) {
            try {
              await restoreCoupon(current.used_coupon_id);
            } catch (err) {
              console.error(`[bulk-status] 주문 ${current.order_number} 쿠폰 복원 실패:`, err);
            }
          }
        }

        // 상태 이력 기록
        await admin.from("order_status_history").insert({
          order_id: id,
          from_status: current.status,
          to_status: status,
          changed_by: "admin",
          note: note ?? "주문 일괄 상태 변경",
        });

        updatedCount++;
      } catch (err: any) {
        console.error(`[PATCH /api/admin/orders/bulk-status] 개별 주문 처리 에러:`, err);
        errors.push(`주문 ID ${id} 처리 중 예상치 못한 오류가 발생했습니다.`);
      }
    }

    return Response.json({
      success: true,
      data: {
        updatedCount,
        failedCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/admin/orders/bulk-status]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

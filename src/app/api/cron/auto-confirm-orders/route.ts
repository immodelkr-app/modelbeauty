// ============================================================
// GET /api/cron/auto-confirm-orders — Vercel Cron 전용 (CRON_SECRET 인증)
// 배송완료(delivered) 후 7일이 지난 주문을 자동으로 구매 확정(confirmed) 처리하고
// 구매 확정 포인트(1%)를 적립한다. 구매 확정 주문은 크루/업체 정산 대상이 된다.
// delivered_at은 DB 트리거가 상태 변경 시점에 기록한다.
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { rewardConfirmPoints } from "@/lib/order-confirm";

const AUTO_CONFIRM_DAYS = 7;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdmin();
    const cutoff = new Date(Date.now() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await admin
      .from("orders")
      .select("id, master_user_id, total_amount, order_number")
      .eq("status", "delivered")
      .lte("delivered_at", cutoff)
      .limit(500);
    if (error) throw error;

    let confirmed = 0;
    let pointFailed = 0;
    for (const order of orders ?? []) {
      // status 조건부 업데이트 — 그 사이 관리자가 취소/확정한 주문은 건드리지 않음(포인트 중복 방지)
      const { data: updated, error: updErr } = await admin
        .from("orders")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("status", "delivered")
        .select("id");
      if (updErr || !updated?.length) continue;
      confirmed++;

      try {
        await rewardConfirmPoints(order);
      } catch (err) {
        pointFailed++;
        console.error(`[auto-confirm-orders] ${order.order_number} 포인트 적립 실패:`, err);
      }
    }

    return Response.json({ success: true, data: { targets: orders?.length ?? 0, confirmed, pointFailed } });
  } catch (err: any) {
    console.error("[GET /api/cron/auto-confirm-orders] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

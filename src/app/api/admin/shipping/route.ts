// ============================================================
// POST /api/admin/shipping — 배송 정보 등록 (Admin Only)
// Body: { orderId, carrierCode, trackingNumber }
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CARRIER_CODES } from "@/lib/sweettracker";

export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { orderId, carrierCode, trackingNumber } = body;

    if (!orderId || !carrierCode || !trackingNumber) {
      return Response.json(
        { success: false, error: "orderId, carrierCode, trackingNumber는 필수입니다." },
        { status: 400 }
      );
    }

    const carrierName = CARRIER_CODES[carrierCode] ?? carrierCode;
    const admin = createSupabaseAdmin();

    // 주문 존재 확인
    const { data: order } = await admin
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (!order) {
      return Response.json({ success: false, error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // shipping_info upsert (UNIQUE order_id)
    const { data: shipping, error } = await admin
      .from("shipping_info")
      .upsert({
        order_id: orderId,
        carrier_code: carrierCode,
        carrier_name: carrierName,
        tracking_number: trackingNumber,
        tracking_url: null,
        shipped_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // 주문 상태를 'shipping'으로 변경 (paid / preparing 인 경우)
    if (order.status === "paid" || order.status === "preparing") {
      await admin
        .from("orders")
        .update({ status: "shipping" })
        .eq("id", orderId);

      await admin.from("order_status_history").insert({
        order_id: orderId,
        from_status: order.status,
        to_status: "shipping",
        changed_by: "admin",
        note: `배송 등록: ${carrierName} ${trackingNumber}`,
      });
    }

    return Response.json({ success: true, data: shipping }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/shipping]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

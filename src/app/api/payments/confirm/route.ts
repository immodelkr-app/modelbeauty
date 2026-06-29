// ============================================================
// API 라우트: 결제 승인 (토스페이먼츠)
// POST /api/payments/confirm
// ============================================================
// 프론트엔드에서 결제 성공 리다이렉트 후 서버에서 최종 승인 처리

import { NextRequest, NextResponse } from "next/server";
import { confirmPayment } from "@/lib/tosspayments";
import { deductPoints, useCoupon } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdmin();

  try {
    const body = await request.json();
    const { orderId, paymentKey, amount } = body;

    if (!orderId || !paymentKey || !amount) {
      return NextResponse.json(
        { error: "orderId, paymentKey, amount는 필수입니다." },
        { status: 400 }
      );
    }

    // 1. 주문 조회 및 금액 검증
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "이미 처리된 주문입니다." },
        { status: 400 }
      );
    }

    if (order.total_amount !== amount) {
      return NextResponse.json(
        { error: "결제 금액이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // 2. 토스페이먼츠 결제 승인
    const paymentResult = await confirmPayment({ paymentKey, orderId, amount });

    // 3. 포인트 차감 (사용한 경우)
    if (order.used_point_amount > 0) {
      await deductPoints({
        masterUserId: order.master_user_id,
        amount: order.used_point_amount,
        description: `주문 결제 포인트 사용 (${order.order_number})`,
      });
    }

    // 4. 쿠폰 사용 처리 (사용한 경우)
    if (order.used_coupon_id) {
      await useCoupon(order.used_coupon_id);
    }

    // 5. 주문 상태 업데이트
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_key: paymentResult.paymentKey,
        payment_method: paymentResult.method,
        payment_status: "paid",
        paid_at: paymentResult.approvedAt,
        status: "paid",
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("[payments/confirm] 주문 상태 업데이트 실패:", updateError);
      // 결제는 성공했으므로 500 대신 부분 성공 응답
    }

    // 6. 주문 상태 이력 기록
    await supabase.from("order_status_history").insert({
      order_id: orderId,
      from_status: "pending",
      to_status: "paid",
      changed_by: "system",
      note: `토스페이먼츠 결제 승인 완료 (${paymentKey})`,
    });

    return NextResponse.json({
      success: true,
      orderNumber: order.order_number,
      paymentKey: paymentResult.paymentKey,
      method: paymentResult.method,
      approvedAt: paymentResult.approvedAt,
    });
  } catch (error) {
    console.error("[/api/payments/confirm]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "결제 승인 실패" },
      { status: 500 }
    );
  }
}

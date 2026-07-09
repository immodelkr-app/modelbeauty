// ============================================================
// API 라우트: 주문 생성
// POST /api/orders
// ============================================================
// 체크아웃 시 pending 상태 주문 레코드 생성
// 결제 완료 후 /api/payments/confirm에서 paid로 업데이트

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { generateOrderNumber } from "@/lib/tosspayments";

const SHIPPING_FREE_THRESHOLD = 50000;
const SHIPPING_FEE = 3000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      masterUserId,
      items,               // [{ cartItemId, productId, variantId, productName, variantInfo, unitPrice, quantity }]
      recipientName,
      recipientPhone,
      addressZipcode,
      addressMain,
      addressDetail,
      deliveryMemo,
      usedPointAmount = 0,
      usedCouponId = null,
      usedCouponCode = null,
      couponDiscount = 0,
      liveStreamId = null,
    } = body;

    if (!items?.length || !recipientName || !recipientPhone || !addressZipcode || !addressMain) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    // 금액 계산
    const subtotal = items.reduce(
      (sum: number, item: { unitPrice: number; quantity: number }) =>
        sum + item.unitPrice * item.quantity,
      0
    );
    const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;

    // 회원 등급 할인 계산 (subtotal 기준 자동 적용)
    const admin = createSupabaseAdmin();
    let membershipDiscount = 0;
    let membershipTierId = "normal";
    try {
      const { data: membership } = await admin
        .from("user_memberships")
        .select("tier_id")
        .eq("master_user_id", masterUserId)
        .maybeSingle();
      if (membership?.tier_id) {
        const { data: tier } = await admin
          .from("membership_tiers")
          .select("id, discount_rate")
          .eq("id", membership.tier_id)
          .maybeSingle();
        if (tier && tier.discount_rate > 0) {
          membershipTierId = tier.id;
          membershipDiscount = Math.floor(subtotal * (tier.discount_rate / 100));
        }
      }
    } catch {
      // 등급 조회 실패 시 할인 없이 진행
    }

    // 포인트 할인 검증 (조건 A: 10,000원 이상 구매 시, 최대 30%까지만 포인트 결제 허용, 최소 1,000P)
    let pointDiscount = 0;
    if (subtotal >= 10000 && usedPointAmount >= 1000) {
      const maxPointsAllowed = Math.floor(subtotal * 0.3);
      pointDiscount = Math.min(usedPointAmount, maxPointsAllowed);
    }
    const totalAmount = Math.max(0, subtotal + shippingFee - membershipDiscount - pointDiscount - couponDiscount);

    const orderNumber = generateOrderNumber();

    // 주문 레코드 생성
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        master_user_id: masterUserId,
        subtotal,
        shipping_fee: shippingFee,
        membership_discount: membershipDiscount,
        membership_tier_id: membershipTierId,
        point_discount: pointDiscount,
        coupon_discount: couponDiscount,
        total_amount: totalAmount,
        payment_status: "pending",
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        address_zipcode: addressZipcode,
        address_main: addressMain,
        address_detail: addressDetail || null,
        delivery_memo: deliveryMemo || null,
        used_point_amount: pointDiscount,
        used_coupon_id: usedCouponId,
        used_coupon_code: usedCouponCode,
        status: "pending",
        live_stream_id: liveStreamId || null,
      })
      .select("id, order_number, total_amount")
      .single();

    if (orderError || !order) {
      console.error("[POST /api/orders] 주문 생성 실패:", orderError);
      return NextResponse.json({ error: "주문 생성에 실패했습니다." }, { status: 500 });
    }

    // 주문 상품 레코드 생성
    const orderItems = items.map((item: {
      productId: string;
      variantId?: string;
      productName: string;
      variantInfo?: Record<string, string>;
      unitPrice: number;
      quantity: number;
    }) => ({
      order_id: order.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
      product_name: item.productName,
      variant_info: item.variantInfo || null,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await admin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("[POST /api/orders] 주문 상품 생성 실패:", itemsError);
      // 주문 롤백
      await admin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "주문 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      totalAmount: order.total_amount,
      membershipDiscount,
      membershipTierId,
    });
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

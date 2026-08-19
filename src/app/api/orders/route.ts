// ============================================================
// API 라우트: 주문 생성
// POST /api/orders
// ============================================================
// 체크아웃 시 pending 상태 주문 레코드 생성
// 결제 완료 후 /api/payments/confirm에서 paid로 업데이트

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { generateOrderNumber } from "@/lib/tosspayments";
import { getMembershipStatus } from "@/lib/membership";

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

    if (items.some((item: { quantity: number }) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ error: "수량은 1 이상의 정수여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 상품 금액은 클라이언트 값을 신뢰하지 않고 DB에서 다시 조회해 서버가 직접 계산
    const productIds: string[] = Array.from(
      new Set(items.map((item: { productId: string }) => item.productId))
    );
    const variantIds: string[] = Array.from(
      new Set(
        items
          .map((item: { variantId?: string }) => item.variantId)
          .filter((id: string | undefined): id is string => Boolean(id))
      )
    );

    const { data: products } = await admin
      .from("products")
      .select("id, base_price, sale_price, is_active")
      .in("id", productIds);
    const { data: variants } = variantIds.length
      ? await admin.from("product_variants").select("id, price_adjustment").in("id", variantIds)
      : { data: [] as { id: string; price_adjustment: number }[] };

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const variantMap = new Map((variants ?? []).map((v) => [v.id, v]));

    const verifiedItems: { productId: string; variantId?: string; productName: string; variantInfo?: Record<string, string>; unitPrice: number; quantity: number }[] = [];
    for (const item of items as { productId: string; variantId?: string; productName: string; variantInfo?: Record<string, string>; quantity: number }[]) {
      const product = productMap.get(item.productId);
      if (!product || !product.is_active) {
        return NextResponse.json({ error: "판매 중이 아니거나 존재하지 않는 상품이 포함되어 있습니다." }, { status: 400 });
      }
      if (item.variantId && !variantMap.has(item.variantId)) {
        return NextResponse.json({ error: "존재하지 않는 옵션이 포함되어 있습니다." }, { status: 400 });
      }
      const priceAdjustment = item.variantId ? (variantMap.get(item.variantId)?.price_adjustment ?? 0) : 0;
      const unitPrice = (product.sale_price ?? product.base_price) + priceAdjustment;
      verifiedItems.push({ ...item, unitPrice });
    }

    // 금액 계산 (서버 검증된 unitPrice 기준)
    const subtotal = verifiedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;

    // 회원 등급 할인 계산 (subtotal 기준 자동 적용, 모델뷰티 로컬 등급 기준)
    let membershipDiscount = 0;
    let membershipTierId = "normal";
    try {
      const { tier } = await getMembershipStatus(masterUserId);
      if (tier.discountRate > 0) {
        membershipTierId = tier.id;
        membershipDiscount = Math.floor(subtotal * (tier.discountRate / 100));
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

    // 주문 상품 레코드 생성 (서버 검증된 unitPrice 사용)
    const orderItems = verifiedItems.map((item) => ({
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

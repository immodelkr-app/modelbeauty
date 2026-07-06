// ============================================================
// GET /api/mypage/orders — 내 주문 내역 목록
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // master_user_id가 없으면 user.id로 폴백
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function GET(request: Request) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = 10;
    const offset = (page - 1) * limit;

    const admin = createSupabaseAdmin();

    const [{ count }, { data, error }] = await Promise.all([
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("master_user_id", masterUserId),
      admin
        .from("orders")
        .select(
          `id, order_number, status, payment_status, payment_method,
           subtotal, shipping_fee, point_discount, coupon_discount, total_amount,
           paid_at, created_at,
           order_items (
             id, product_name, variant_info, unit_price, quantity, subtotal,
             products ( id, slug, images )
           ),
           shipping_info ( carrier_name, tracking_number, shipped_at, delivered_at )`
        )
        .eq("master_user_id", masterUserId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    ]);

    if (error) throw error;

    const orders = (data ?? []).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      subtotal: o.subtotal,
      shippingFee: o.shipping_fee,
      pointDiscount: o.point_discount,
      couponDiscount: o.coupon_discount,
      totalAmount: o.total_amount,
      paidAt: o.paid_at,
      createdAt: o.created_at,
      itemCount: (o.order_items as unknown[])?.length ?? 0,
      firstItem: (() => {
        type OrderItemRaw = {
          product_name: string;
          variant_info: Record<string, string> | null;
          quantity: number;
          products: { id: string; slug: string; images: { url: string; alt: string }[] } | null;
        };
        const items = (o.order_items as unknown) as OrderItemRaw[];
        if (!items?.length) return null;
        const item = items[0];
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return {
          productName: item.product_name,
          variantInfo: item.variant_info,
          quantity: item.quantity,
          imageUrl: product?.images?.[0]?.url ?? null,
          slug: product?.slug ?? null,
        };
      })(),
      shippingInfo: (() => {
        const info = o.shipping_info as {
          carrier_name: string;
          tracking_number: string;
          shipped_at: string;
          delivered_at: string | null;
        }[] | null;
        if (!info || !info.length) return null;
        const s = Array.isArray(info) ? info[0] : info;
        return {
          carrierName: s.carrier_name,
          trackingNumber: s.tracking_number,
          shippedAt: s.shipped_at,
          deliveredAt: s.delivered_at,
        };
      })(),
    }));

    return Response.json({
      success: true,
      data: {
        orders,
        total: count ?? 0,
        page,
        limit,
        hasMore: (count ?? 0) > offset + limit,
      },
    });
  } catch (err) {
    console.error("[GET /api/mypage/orders]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

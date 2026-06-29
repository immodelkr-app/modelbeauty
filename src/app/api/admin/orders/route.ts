// ============================================================
// GET  /api/admin/orders — 주문 목록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const status = url.searchParams.get("status") ?? "";
    const search = url.searchParams.get("search") ?? "";
    const offset = (page - 1) * limit;

    const admin = createSupabaseAdmin();
    let query = admin
      .from("orders")
      .select(
        `id, order_number, status, payment_status, payment_method,
         total_amount, subtotal, shipping_fee,
         recipient_name, recipient_phone,
         created_at, paid_at,
         order_items ( id, product_name, quantity, subtotal )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`order_number.ilike.%${search}%,recipient_name.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    const orders = (data ?? []).map((o) => {
      const items = o.order_items as { product_name: string; quantity: number; subtotal: number }[];
      return {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        totalAmount: o.total_amount,
        subtotal: o.subtotal,
        shippingFee: o.shipping_fee,
        recipientName: o.recipient_name,
        recipientPhone: o.recipient_phone,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        itemCount: items?.length ?? 0,
        firstProductName: items?.[0]?.product_name ?? "—",
      };
    });

    return Response.json({
      success: true,
      data: { orders, total: count ?? 0, page, limit, hasMore: (count ?? 0) > offset + limit },
    });
  } catch (err) {
    console.error("[GET /api/admin/orders]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

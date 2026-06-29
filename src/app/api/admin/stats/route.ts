// ============================================================
// GET  /api/admin/stats — 대시보드 통계
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalProducts },
      { count: activeProducts },
      { count: lowStockProducts },
      { count: totalOrders },
      { count: todayOrders },
      { data: recentOrders },
    ] = await Promise.all([
      admin.from("products").select("id", { count: "exact", head: true }),
      admin.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      admin.from("products").select("id", { count: "exact", head: true }).lte("stock_quantity", 10).eq("is_active", true),
      admin.from("orders").select("id", { count: "exact", head: true }),
      admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      admin.from("orders")
        .select(`id, order_number, status, total_amount, created_at,
                 order_items ( product_name )`)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    // 오늘 매출합계
    const { data: todaySales } = await admin
      .from("orders")
      .select("total_amount")
      .gte("created_at", today.toISOString())
      .eq("payment_status", "paid");

    const todayRevenue = (todaySales ?? []).reduce(
      (sum, o) => sum + (o.total_amount ?? 0),
      0
    );

    return Response.json({
      success: true,
      data: {
        totalProducts: totalProducts ?? 0,
        activeProducts: activeProducts ?? 0,
        lowStockProducts: lowStockProducts ?? 0,
        totalOrders: totalOrders ?? 0,
        todayOrders: todayOrders ?? 0,
        todayRevenue,
        recentOrders: (recentOrders ?? []).map((o) => {
          const items = o.order_items as { product_name: string }[];
          return {
            id: o.id,
            orderNumber: o.order_number,
            status: o.status,
            totalAmount: o.total_amount,
            createdAt: o.created_at,
            firstProductName: items?.[0]?.product_name ?? "—",
          };
        }),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/stats]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

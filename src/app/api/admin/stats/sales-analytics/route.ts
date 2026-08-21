// ============================================================
// GET /api/admin/stats/sales-analytics — 매출 분석 종합 데이터
// 일/주/월 매출 요약, 30일 추이, 카테고리별 매출, 탑5 상품
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function startOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcChangeRate(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 1000) / 10; // 소수점 1자리
}

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const now = new Date();

    // ── 기간 경계값 계산 ─────────────────────────────────────
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subtractDays(now, 1));
    const thisWeekStart = startOfWeek(now).toISOString();
    const lastWeekStart = startOfWeek(subtractDays(now, 7)).toISOString();
    const lastWeekEnd = startOfWeek(now).toISOString();
    const thisMonthStart = startOfMonth(now).toISOString();
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)).toISOString();
    const lastMonthEnd = thisMonthStart;
    const thirtyDaysAgo = subtractDays(now, 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // ── 결제 완료된 주문 기반 쿼리 헬퍼 ─────────────────────────

    // 일 매출 (오늘, 어제)
    const [todayOrders, yesterdayOrders, thisWeekOrders, lastWeekOrders, thisMonthOrders, lastMonthOrders] =
      await Promise.all([
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", todayStart),
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", yesterdayStart).lt("created_at", todayStart),
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", thisWeekStart),
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", lastWeekStart).lt("created_at", lastWeekEnd),
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", thisMonthStart),
        admin.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", lastMonthStart).lt("created_at", lastMonthEnd),
      ]);

    const sumRevenue = (rows: { total_amount: number }[] | null) =>
      (rows ?? []).reduce((acc, r) => acc + (r.total_amount ?? 0), 0);

    const todayRevenue = sumRevenue(todayOrders.data);
    const yesterdayRevenue = sumRevenue(yesterdayOrders.data);
    const thisWeekRevenue = sumRevenue(thisWeekOrders.data);
    const lastWeekRevenue = sumRevenue(lastWeekOrders.data);
    const thisMonthRevenue = sumRevenue(thisMonthOrders.data);
    const lastMonthRevenue = sumRevenue(lastMonthOrders.data);

    const revenueSummary = {
      today: {
        revenue: todayRevenue,
        orderCount: todayOrders.data?.length ?? 0,
        prevRevenue: yesterdayRevenue,
        changeRate: calcChangeRate(todayRevenue, yesterdayRevenue),
      },
      thisWeek: {
        revenue: thisWeekRevenue,
        orderCount: thisWeekOrders.data?.length ?? 0,
        prevRevenue: lastWeekRevenue,
        changeRate: calcChangeRate(thisWeekRevenue, lastWeekRevenue),
      },
      thisMonth: {
        revenue: thisMonthRevenue,
        orderCount: thisMonthOrders.data?.length ?? 0,
        prevRevenue: lastMonthRevenue,
        changeRate: calcChangeRate(thisMonthRevenue, lastMonthRevenue),
      },
    };

    // ── 최근 30일 일별 매출 추이 ─────────────────────────────────
    const { data: recentOrders } = await admin
      .from("orders")
      .select("total_amount, created_at")
      .eq("payment_status", "paid")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true });

    // 날짜별 집계
    const dailyMap: Record<string, { revenue: number; orderCount: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = subtractDays(now, i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { revenue: 0, orderCount: 0 };
    }
    for (const o of recentOrders ?? []) {
      const key = o.created_at.slice(0, 10);
      if (dailyMap[key] !== undefined) {
        dailyMap[key].revenue += o.total_amount ?? 0;
        dailyMap[key].orderCount++;
      }
    }
    const dailyRevenue = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

    // ── 카테고리별 매출 (이번 달 기준) ──────────────────────────
    // order_items → products.category_id → categories.name 집계
    const { data: categoryData } = await admin
      .from("order_items")
      .select(`
        subtotal,
        quantity,
        orders!inner ( created_at, payment_status ),
        products ( category_id, categories!products_category_id_fkey ( id, name ) )
      `)
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", thisMonthStart);

    // 카테고리별 집계 맵
    const catMap: Record<
      string,
      { categoryId: string; categoryName: string; todayRevenue: number; weekRevenue: number; monthRevenue: number; orderCount: number; itemCount: number }
    > = {};

    // 일/주 기준 날짜도 함께 처리하기 위해 전체 기간 조회 후 클라이언트 필터
    const { data: allCategoryData } = await admin
      .from("order_items")
      .select(`
        subtotal,
        quantity,
        orders!inner ( created_at, payment_status ),
        products ( category_id, categories!products_category_id_fkey ( id, name ) )
      `)
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", thisMonthStart);

    for (const item of allCategoryData ?? []) {
      const prod = item.products as any;
      const cat = prod?.categories as any;
      if (!cat) continue;
      const catId = cat.id as string;
      const catName = cat.name as string;
      const order = item.orders as any;
      const orderDate = order?.created_at as string;

      if (!catMap[catId]) {
        catMap[catId] = { categoryId: catId, categoryName: catName, todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, orderCount: 0, itemCount: 0 };
      }

      const subtotal = item.subtotal as number ?? 0;
      const qty = item.quantity as number ?? 0;

      catMap[catId].monthRevenue += subtotal;
      catMap[catId].itemCount += qty;
      catMap[catId].orderCount++;

      if (orderDate >= todayStart) {
        catMap[catId].todayRevenue += subtotal;
      }
      if (orderDate >= thisWeekStart) {
        catMap[catId].weekRevenue += subtotal;
      }
    }

    const categoryRevenue = Object.values(catMap).sort((a, b) => b.monthRevenue - a.monthRevenue);

    // 베스트 카테고리 (월 매출 1위)
    const totalMonthRevenue = categoryRevenue.reduce((acc, c) => acc + c.monthRevenue, 0);
    const bestCategory = categoryRevenue[0]
      ? {
          categoryId: categoryRevenue[0].categoryId,
          categoryName: categoryRevenue[0].categoryName,
          monthRevenue: categoryRevenue[0].monthRevenue,
          share: totalMonthRevenue > 0 ? Math.round((categoryRevenue[0].monthRevenue / totalMonthRevenue) * 1000) / 10 : 0,
        }
      : null;

    // ── 베스트 상품 TOP 5 (이번 달 기준) ────────────────────────
    const { data: topItemData } = await admin
      .from("order_items")
      .select(`
        product_id,
        product_name,
        subtotal,
        quantity,
        orders!inner ( payment_status, created_at ),
        products ( images )
      `)
      .eq("orders.payment_status", "paid")
      .gte("orders.created_at", thisMonthStart);

    const productMap: Record<
      string,
      { productId: string; productName: string; productImage: string | null; totalRevenue: number; totalQuantity: number; orderCount: number }
    > = {};

    for (const item of topItemData ?? []) {
      const pid = item.product_id as string;
      const pname = item.product_name as string;
      const prod = item.products as any;
      const imgUrl = prod?.images?.[0]?.url ?? null;

      if (!productMap[pid]) {
        productMap[pid] = { productId: pid, productName: pname, productImage: imgUrl, totalRevenue: 0, totalQuantity: 0, orderCount: 0 };
      }
      productMap[pid].totalRevenue += item.subtotal as number ?? 0;
      productMap[pid].totalQuantity += item.quantity as number ?? 0;
      productMap[pid].orderCount++;
    }

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return Response.json({
      success: true,
      data: {
        revenueSummary,
        dailyRevenue,
        categoryRevenue,
        topProducts,
        bestCategory,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/stats/sales-analytics]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

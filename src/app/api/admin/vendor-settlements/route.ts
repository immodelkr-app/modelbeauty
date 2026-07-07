import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/vendor-settlements — 업체 정산 내역 조회
 */
export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get("yearMonth");

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json(
      { success: false, error: "올바른 정산 연월(YYYY-MM) 형식이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdmin();

    const { data: settlements, error } = await admin
      .from("vendor_settlement_history")
      .select(`
        *,
        vendor:vendors ( id, name, contact_name, contact_phone, bank_name, account_number, account_holder )
      `)
      .eq("year_month", yearMonth)
      .order("total_payout", { ascending: false });

    if (error) throw error;

    // 월별 추이 (최근 6개월)
    const { data: trendData } = await admin
      .from("vendor_settlement_history")
      .select("year_month, total_sales, total_payout")
      .order("year_month", { ascending: true });

    const trendMap: Record<string, { yearMonth: string; totalSales: number; totalPayout: number }> = {};
    (trendData ?? []).forEach((t: any) => {
      if (!trendMap[t.year_month]) {
        trendMap[t.year_month] = { yearMonth: t.year_month, totalSales: 0, totalPayout: 0 };
      }
      trendMap[t.year_month].totalSales += t.total_sales;
      trendMap[t.year_month].totalPayout += t.total_payout;
    });

    const processedSettlements = (settlements ?? []).map((s: any) => ({
      id: s.id,
      yearMonth: s.year_month,
      vendorId: s.vendor_id,
      vendorName: s.vendor?.name ?? "—",
      contactName: s.vendor?.contact_name ?? "—",
      contactPhone: s.vendor?.contact_phone ?? "—",
      bankName: s.vendor?.bank_name ?? "—",
      accountHolder: s.vendor?.account_holder ?? "—",
      accountNumber: s.vendor?.account_number ?? "—",
      totalSales: s.total_sales,
      totalPayout: s.total_payout,
      payoutStatus: s.payout_status,
      note: s.note,
      createdAt: s.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        settlements: processedSettlements,
        trends: Object.values(trendMap).slice(-6),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/vendor-settlements]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/vendor-settlements — 업체 정산 계산 및 저장
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { yearMonth } = body;

    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json(
        { success: false, error: "올바른 정산 연월(YYYY-MM) 형식이 필요합니다." },
        { status: 400 }
      );
    }

    const [yearStr, monthStr] = yearMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const startDateStr = `${yearMonth}-01T00:00:00+09:00`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthStr = String(nextMonth).padStart(2, "0");
    const endDateStr = `${nextYear}-${nextMonthStr}-01T00:00:00+09:00`;

    const admin = createSupabaseAdmin();

    // 1. 해당 월의 구매확정 라이브 연계 주문의 order_items 조회 (상품 벤더 정보 포함)
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select(`
        id,
        total_amount,
        subtotal,
        live_stream_id,
        order_items (
          id,
          product_id,
          unit_price,
          quantity,
          subtotal
        )
      `)
      .eq("status", "confirmed")
      .not("live_stream_id", "is", null)
      .gte("created_at", startDateStr)
      .lt("created_at", endDateStr);

    if (ordersErr) throw ordersErr;

    // 2. 관련 product의 vendor 정보 조회
    const productIds = new Set<string>();
    (orders ?? []).forEach((o: any) => {
      (o.order_items ?? []).forEach((item: any) => {
        if (item.product_id) productIds.add(item.product_id);
      });
    });

    const { data: products, error: prodErr } = await admin
      .from("products")
      .select("id, vendor_id, vendor_cost_type, vendor_cost_rate, vendor_supply_price")
      .in("id", Array.from(productIds));

    if (prodErr) throw prodErr;

    // product map
    const productMap: Record<string, { vendorId: string | null; costType: string; costRate: number; supplyPrice: number }> = {};
    (products ?? []).forEach((p: any) => {
      productMap[p.id] = {
        vendorId: p.vendor_id,
        costType: p.vendor_cost_type,
        costRate: Number(p.vendor_cost_rate),
        supplyPrice: p.vendor_supply_price,
      };
    });

    // 3. 방송별 크루 수수료율 조회
    const streamIds = new Set<string>();
    (orders ?? []).forEach((o: any) => { if (o.live_stream_id) streamIds.add(o.live_stream_id); });

    const { data: streamCrews } = await admin
      .from("live_stream_crews")
      .select("stream_id, commission_rate")
      .in("stream_id", Array.from(streamIds));

    const streamCommissionMap: Record<string, number> = {};
    (streamCrews ?? []).forEach((sc: any) => {
      streamCommissionMap[sc.stream_id] = Number(sc.commission_rate);
    });

    // 4. 업체별 정산 계산
    // vendorId -> { totalSales, totalPayout }
    const vendorMap: Record<string, { totalSales: number; totalPayout: number }> = {};

    (orders ?? []).forEach((order: any) => {
      const orderSubtotal = order.subtotal ?? order.total_amount;
      const orderTotal = order.total_amount ?? 0;
      // 할인 비례 계수 (쿠폰/포인트 할인 배분)
      const discountRatio = orderSubtotal > 0 ? orderTotal / orderSubtotal : 1;
      const commissionRate = streamCommissionMap[order.live_stream_id] ?? 0;

      (order.order_items ?? []).forEach((item: any) => {
        const product = productMap[item.product_id];
        if (!product || !product.vendorId) return;

        const itemSales = (item.unit_price ?? 0) * (item.quantity ?? 1);
        const adjustedSales = Math.floor(itemSales * discountRatio);

        // 크루 수수료 먼저 차감
        const crewCommission = Math.floor(adjustedSales * (commissionRate / 100));

        // 업체 지급액 계산
        let vendorPayout: number;
        if (product.costType === "rate") {
          vendorPayout = Math.floor(adjustedSales * (product.costRate / 100));
        } else {
          // 고정 공급가: 수량 반영, 할인 배분 미적용
          vendorPayout = product.supplyPrice * (item.quantity ?? 1);
        }

        const vendorId = product.vendorId;
        if (!vendorMap[vendorId]) {
          vendorMap[vendorId] = { totalSales: 0, totalPayout: 0 };
        }
        vendorMap[vendorId].totalSales += adjustedSales;
        vendorMap[vendorId].totalPayout += vendorPayout;

        // 크루 수수료 로그 (참고용)
        void crewCommission;
      });
    });

    // 5. vendor_settlement_history upsert
    const upsertRows = Object.entries(vendorMap)
      .filter(([, v]) => v.totalSales > 0)
      .map(([vendorId, v]) => ({
        year_month: yearMonth,
        vendor_id: vendorId,
        total_sales: v.totalSales,
        total_payout: v.totalPayout,
        payout_status: "pending",
      }));

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await admin
        .from("vendor_settlement_history")
        .upsert(upsertRows, { onConflict: "year_month,vendor_id" });

      if (upsertErr) throw upsertErr;
    }

    return NextResponse.json({
      success: true,
      message: `${upsertRows.length}개 업체 정산 데이터가 계산 및 저장되었습니다.`,
    });
  } catch (err) {
    console.error("[POST /api/admin/vendor-settlements]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/vendor-settlements — 업체 정산 상태 변경
 */
export async function PUT(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json(
        { success: false, error: "필수 정보(ids, status)가 누락되었습니다." },
        { status: 400 }
      );
    }
    if (!["pending", "paid", "withheld"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 지급 상태값입니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("vendor_settlement_history")
      .update({ payout_status: status })
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "업체 정산 상태가 업데이트되었습니다." });
  } catch (err) {
    console.error("[PUT /api/admin/vendor-settlements]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

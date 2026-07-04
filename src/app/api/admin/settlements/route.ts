import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { decryptText, maskAccountNumber } from "@/lib/encryption";

/**
 * GET /api/admin/settlements - 정산 내역 및 통계/추이 조회
 */
export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { searchParams } = new URL(request.url);
  const yearMonth = searchParams.get("yearMonth"); // e.g. "2026-06"

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ success: false, error: "올바른 정산 연월(YYYY-MM) 형식이 필요합니다." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdmin();

    // 1. 해당 월의 정산 내역 조회 (크루 정보 JOIN)
    const { data: settlements, error: setErr } = await admin
      .from("crew_settlement_history")
      .select(`
        *,
        crew:live_crews (
          name,
          nickname,
          phone,
          bank_name,
          account_number
        )
      `)
      .eq("year_month", yearMonth);

    if (setErr) {
      console.error("[GET /api/admin/settlements] DB Error:", setErr);
      return NextResponse.json({ success: false, error: "정산 데이터를 조회할 수 없습니다." }, { status: 500 });
    }

    // 민감 정보 복호화 및 마스킹 처리하여 프론트엔드로 안전하게 전송
    const processedSettlements = (settlements ?? []).map((s: any) => {
      let accPlain = "";
      if (s.crew?.account_number) {
        try {
          accPlain = decryptText(s.crew.account_number);
        } catch {
          // ignore
        }
      }
      return {
        id: s.id,
        yearMonth: s.year_month,
        crewId: s.crew_id,
        totalSales: s.total_sales,
        totalSettlement: s.total_settlement,
        taxAmount: s.tax_amount,
        netPayout: s.net_payout,
        payoutStatus: s.payout_status,
        note: s.note,
        createdAt: s.created_at,
        crewName: s.crew?.name ?? "—",
        crewNickname: s.crew?.nickname ?? "—",
        crewPhone: s.crew?.phone ?? "—",
        bankName: s.crew?.bank_name ?? "—",
        maskedAccountNumber: maskAccountNumber(accPlain),
      };
    });

    // 2. 전체 월별 정산 추이 조회 (최근 6개월)
    const { data: trendData, error: trendErr } = await admin
      .from("crew_settlement_history")
      .select("year_month, total_sales, total_settlement, net_payout")
      .order("year_month", { ascending: true });

    if (trendErr) {
      console.error("[GET /api/admin/settlements] Trend Query Error:", trendErr);
    }

    // 월별로 집계 그룹핑
    const trendMap: Record<string, { yearMonth: string; totalSales: number; totalSettlement: number; netPayout: number }> = {};
    (trendData ?? []).forEach((t: any) => {
      if (!trendMap[t.year_month]) {
        trendMap[t.year_month] = {
          yearMonth: t.year_month,
          totalSales: 0,
          totalSettlement: 0,
          netPayout: 0,
        };
      }
      trendMap[t.year_month].totalSales += t.total_sales;
      trendMap[t.year_month].totalSettlement += t.total_settlement;
      trendMap[t.year_month].netPayout += t.net_payout;
    });

    const monthlyTrends = Object.values(trendMap).slice(-6); // 최근 6개월 분량만

    return NextResponse.json({
      success: true,
      data: {
        settlements: processedSettlements,
        trends: monthlyTrends,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/settlements]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/settlements - 정산 데이터 계산 및 저장
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { yearMonth } = body; // e.g. "2026-06"

    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ success: false, error: "올바른 정산 연월(YYYY-MM) 형식이 필요합니다." }, { status: 400 });
    }

    const [yearStr, monthStr] = yearMonth.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // 검색 대상 주문 시간대 (한국 시간 기준)
    const startDateStr = `${yearMonth}-01T00:00:00+09:00`;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthStr = String(nextMonth).padStart(2, "0");
    const endDateStr = `${nextYear}-${nextMonthStr}-01T00:00:00+09:00`;

    const admin = createSupabaseAdmin();

    // 1. 해당 월에 생성되고 'confirmed' (구매확정) 된 라이브 연계 주문들 조회
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("id, total_amount, live_stream_id")
      .eq("status", "confirmed")
      .not("live_stream_id", "is", null)
      .gte("created_at", startDateStr)
      .lt("created_at", endDateStr);

    if (ordersErr) {
      console.error("[POST /api/admin/settlements] Orders Fetch Error:", ordersErr);
      return NextResponse.json({ success: false, error: "대상 주문 데이터를 불러올 수 없습니다." }, { status: 500 });
    }

    // 2. 전체 크루 목록 조회 (기본 정산비율 참고용)
    const { data: crews, error: crewsErr } = await admin
      .from("live_crews")
      .select("id, default_commission_rate");

    if (crewsErr || !crews) {
      console.error("[POST /api/admin/settlements] Crews Fetch Error:", crewsErr);
      return NextResponse.json({ success: false, error: "크루 정보를 불러올 수 없습니다." }, { status: 500 });
    }

    // 3. 방송별 크루 매핑 정보 조회
    const { data: streamCrews, error: streamCrewsErr } = await admin
      .from("live_stream_crews")
      .select("stream_id, crew_id, commission_rate");

    if (streamCrewsErr) {
      console.error("[POST /api/admin/settlements] Stream Crews Fetch Error:", streamCrewsErr);
      return NextResponse.json({ success: false, error: "방송-크루 매핑 정보를 불러올 수 없습니다." }, { status: 500 });
    }

    // 매핑 딕셔너리 구축: stream_id -> [{ crew_id, commission_rate }]
    const streamCrewMap: Record<string, { crew_id: string; commission_rate: number }[]> = {};
    (streamCrews ?? []).forEach((sc: any) => {
      if (!streamCrewMap[sc.stream_id]) {
        streamCrewMap[sc.stream_id] = [];
      }
      streamCrewMap[sc.stream_id].push({
        crew_id: sc.crew_id,
        commission_rate: Number(sc.commission_rate),
      });
    });

    // 4. 매출 계산 및 크루별 정산액 계산
    // crewId -> { totalSales, totalSettlement }
    const crewSettlementMap: Record<string, { totalSales: number; totalSettlement: number }> = {};
    
    // 크루 맵 초기화
    crews.forEach((c) => {
      crewSettlementMap[c.id] = { totalSales: 0, totalSettlement: 0 };
    });

    (orders ?? []).forEach((order: any) => {
      const streamId = order.live_stream_id;
      const salesAmount = order.total_amount ?? 0;
      const mappedCrews = streamCrewMap[streamId] ?? [];

      mappedCrews.forEach((mc) => {
        const crewData = crewSettlementMap[mc.crew_id];
        if (crewData) {
          crewData.totalSales += salesAmount;
          // 크루 정산금 = 방송 매출 * 정산 비율(%)
          const commission = Math.floor(salesAmount * (mc.commission_rate / 100));
          crewData.totalSettlement += commission;
        }
      });
    });

    // 5. 정산 내역 DB에 upsert (매출이 있거나 기존 정산 데이터가 있던 크루 대상)
    const upsertRows = crews
      .map((c) => {
        const calcData = crewSettlementMap[c.id];
        const totalSales = calcData.totalSales;
        const totalSettlement = calcData.totalSettlement;
        
        // 3.3% 원천세 계산 (소수점 버림)
        const taxAmount = Math.floor(totalSettlement * 0.033);
        const netPayout = totalSettlement - taxAmount;

        return {
          year_month: yearMonth,
          crew_id: c.id,
          total_sales: totalSales,
          total_settlement: totalSettlement,
          tax_amount: taxAmount,
          net_payout: netPayout,
          payout_status: "pending", // 재계산 시 기본 대기상태
        };
      })
      .filter((row) => row.total_sales > 0); // 매출액이 존재하는 크루만 저장

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await admin
        .from("crew_settlement_history")
        .upsert(upsertRows, { onConflict: "year_month,crew_id" });

      if (upsertErr) {
        console.error("[POST /api/admin/settlements] DB Upsert Error:", upsertErr);
        return NextResponse.json({ success: false, error: "정산 결과 저장에 실패했습니다." }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${upsertRows.length}명의 크루 정산 데이터가 계산 및 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error("[POST /api/admin/settlements]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settlements - 지급 상태 업데이트
 */
export async function PUT(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { ids, status } = body; // ids: UUID[], status: 'pending' | 'paid' | 'withheld'

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json({ success: false, error: "필수 정보(ids, status)가 누락되었습니다." }, { status: 400 });
    }

    if (!["pending", "paid", "withheld"].includes(status)) {
      return NextResponse.json({ success: false, error: "유효하지 않은 지급 상태값입니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("crew_settlement_history")
      .update({ payout_status: status })
      .in("id", ids);

    if (error) {
      console.error("[PUT /api/admin/settlements] DB Update Error:", error);
      return NextResponse.json({ success: false, error: "지급 상태 변경에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "지급 상태가 업데이트되었습니다." });
  } catch (error) {
    console.error("[PUT /api/admin/settlements]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

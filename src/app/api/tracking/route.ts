// ============================================================
// GET /api/tracking — 배송 조회 API (인증 필요)
// Query: ?carrierCode=04&trackingNumber=1234567890
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { fetchTrackingInfo } from "@/lib/sweettracker";

export async function GET(request: Request) {
  try {
    // 인증 확인
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const url = new URL(request.url);
    const carrierCode = url.searchParams.get("carrierCode") ?? "";
    const trackingNumber = url.searchParams.get("trackingNumber") ?? "";
    const orderId = url.searchParams.get("orderId") ?? "";

    if (!carrierCode || !trackingNumber) {
      return Response.json(
        { success: false, error: "택배사 코드와 운송장 번호는 필수입니다." },
        { status: 400 }
      );
    }

    // orderId가 있으면 해당 주문의 소유자인지 검증
    if (orderId) {
      const masterUserId = user.user_metadata?.master_user_id as string;
      if (masterUserId) {
        const admin = createSupabaseAdmin();
        const { data: order } = await admin
          .from("orders")
          .select("id")
          .eq("id", orderId)
          .eq("master_user_id", masterUserId)
          .single();

        if (!order) {
          return Response.json(
            { success: false, error: "주문을 찾을 수 없습니다." },
            { status: 404 }
          );
        }
      }
    }

    // 스마트택배 API 호출
    const result = await fetchTrackingInfo(carrierCode, trackingNumber);

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    // shipping_info 테이블에 최신 배송 상태 캐시 업데이트 (orderId 있을 때)
    if (orderId && result.data) {
      const admin = createSupabaseAdmin();
      const isDelivered = result.data.complete;
      await admin
        .from("shipping_info")
        .update({
          last_tracked_at: new Date().toISOString(),
          tracking_status: result.data.lastStateDetail ?? null,
          delivered_at: isDelivered ? new Date().toISOString() : null,
        })
        .eq("order_id", orderId);
    }

    return Response.json({ success: true, data: result.data });
  } catch (err) {
    console.error("[GET /api/tracking]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

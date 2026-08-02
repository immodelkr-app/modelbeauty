// ============================================================
// GET   /api/live/[id] — 단일 라이브 방송 상세 조회
// PATCH /api/live/[id] — 라이브 방송 정보 수정 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: stream, error } = await supabase
      .from("live_streams")
      .select(`
        *,
        live_stream_products (
          product_id,
          sort_order,
          is_live_deal,
          deal_ends_at,
          products (
            id, name, slug, base_price, sale_price, images, is_active, stock_quantity
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !stream) {
      return Response.json({ success: false, error: "방송을 찾을 수 없습니다." }, { status: 404 });
    }

    // 이 방송으로 귀속된 결제완료 주문의 상품별 판매수량 집계 ("실시간 판매량" 뱃지용)
    const { data: soldRows } = await supabase
      .from("order_items")
      .select("product_id, quantity, orders!inner(live_stream_id, payment_status)")
      .eq("orders.live_stream_id", id)
      .eq("orders.payment_status", "paid");

    const soldCountByProduct = new Map<string, number>();
    for (const row of soldRows ?? []) {
      const prev = soldCountByProduct.get(row.product_id) ?? 0;
      soldCountByProduct.set(row.product_id, prev + row.quantity);
    }

    // 매핑 상품 추출 및 정렬
    const rawProducts = stream.live_stream_products ?? [];
    const products = rawProducts
      .map((lp: any) => {
        const prod = lp.products;
        if (!prod) return null;
        return {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          basePrice: prod.base_price,
          salePrice: prod.sale_price,
          images: prod.images ?? [],
          isActive: prod.is_active,
          stockQuantity: prod.stock_quantity,
          sortOrder: lp.sort_order,
          isLiveDeal: lp.is_live_deal ?? false,
          dealEndsAt: lp.deal_ends_at ?? null,
          soldCount: soldCountByProduct.get(prod.id) ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    // 알림 구독자 수 (관리자 제어실 참고용)
    const { count: subscriberCount } = await supabase
      .from("live_stream_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", id);

    const streamData = {
      id: stream.id,
      title: stream.title,
      description: stream.description,
      streamerName: stream.streamer_name,
      status: stream.status,
      coverImageUrl: stream.cover_image_url,
      streamUrl: stream.stream_url,
      replayUrl: stream.replay_url,
      activeProductId: stream.active_product_id,
      pinnedMessage: stream.pinned_message ?? null,
      viewerCount: stream.viewer_count,
      subscriberCount: subscriberCount ?? 0,
      createdAt: stream.created_at,
      startedAt: stream.started_at,
      endedAt: stream.ended_at,
      scheduledAt: stream.scheduled_at || null,
      products,
      ingestEndpoint: stream.ingest_endpoint || null,
      streamKey: stream.stream_key || null,
      channelArn: stream.channel_arn || null,
    };

    return Response.json({ success: true, data: streamData });
  } catch (err: any) {
    console.error("[GET /api/live/[id]] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      streamerName,
      status,
      coverImageUrl,
      streamUrl,
      replayUrl,
      scheduledAt,
      productIds, // 변경할 상품 매핑 배열
    } = body;

    const admin = createSupabaseAdmin();

    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (streamerName !== undefined) updatePayload.streamer_name = streamerName;
    if (status !== undefined) {
      updatePayload.status = status;
      if (status === "live") {
        updatePayload.started_at = new Date().toISOString();
      } else if (status === "ended") {
        updatePayload.ended_at = new Date().toISOString();
      }
    }
    if (coverImageUrl !== undefined) updatePayload.cover_image_url = coverImageUrl;
    if (streamUrl !== undefined) updatePayload.stream_url = streamUrl;
    if (replayUrl !== undefined) updatePayload.replay_url = replayUrl;
    if (scheduledAt !== undefined) updatePayload.scheduled_at = scheduledAt || null;

    // 1. 라이브 방송 정보 업데이트
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await admin
        .from("live_streams")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // 2. 상품 매핑 정보 업데이트
    if (productIds !== undefined) {
      // 기존 매핑 삭제
      const { error: deleteError } = await admin
        .from("live_stream_products")
        .delete()
        .eq("stream_id", id);

      if (deleteError) throw deleteError;

      // 새 매핑 추가
      if (productIds.length > 0) {
        const mappings = productIds.map((productId: string, index: number) => ({
          stream_id: id,
          product_id: productId,
          sort_order: index,
        }));

        const { error: insertError } = await admin
          .from("live_stream_products")
          .insert(mappings);

        if (insertError) throw insertError;
      }
    }

    return Response.json({ success: true, message: "수정 완료" });
  } catch (err: any) {
    console.error("[PATCH /api/live/[id]] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

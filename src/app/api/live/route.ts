// ============================================================
// GET  /api/live — 라이브 방송 목록 조회
// POST /api/live — 라이브 방송 신규 등록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status"); // upcoming | live | ended | all

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("live_streams")
      .select(`
        *,
        live_stream_products (
          product_id,
          sort_order,
          products (
            id, name, slug, base_price, sale_price, images, is_active
          )
        )
      `);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // 라이브 진행 중인 것을 우선, 그 다음 최신 등록순
    query = query.order("status", { ascending: false }).order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // 카멜케이스 변환 및 데이터 정돈
    const streams = (data ?? []).map((stream) => {
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
            sortOrder: lp.sort_order,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

      return {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        streamerName: stream.streamer_name,
        status: stream.status,
        coverImageUrl: stream.cover_image_url,
        streamUrl: stream.stream_url,
        replayUrl: stream.replay_url,
        activeProductId: stream.active_product_id,
        viewerCount: stream.viewer_count,
        createdAt: stream.created_at,
        startedAt: stream.started_at,
        endedAt: stream.ended_at,
        products,
      };
    });

    return Response.json({ success: true, data: streams });
  } catch (err: any) {
    console.error("[GET /api/live] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      title,
      description,
      streamerName,
      status = "upcoming",
      coverImageUrl,
      streamUrl,
      replayUrl,
      productIds = [],
    } = body;

    if (!title || !streamerName) {
      return Response.json({ success: false, error: "제목과 스트리머 이름은 필수입니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 1. 라이브 방송 생성
    const { data: stream, error: streamError } = await admin
      .from("live_streams")
      .insert({
        title,
        description: description || null,
        streamer_name: streamerName,
        status,
        cover_image_url: coverImageUrl || null,
        stream_url: streamUrl || null,
        replay_url: replayUrl || null,
        started_at: status === "live" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (streamError) throw streamError;

    // 2. 상품 매핑 정보 생성
    if (productIds.length > 0) {
      const mappings = productIds.map((productId: string, index: number) => ({
        stream_id: stream.id,
        product_id: productId,
        sort_order: index,
      }));

      const { error: mappingError } = await admin
        .from("live_stream_products")
        .insert(mappings);

      if (mappingError) {
        console.error("[POST /api/live] Mapping error:", mappingError);
        // 라이브 방송 생성에 오류가 없었으므로 롤백하지 않고 그냥 경고만 남김
      }
    }

    return Response.json({
      success: true,
      data: {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        streamerName: stream.streamer_name,
        status: stream.status,
        coverImageUrl: stream.cover_image_url,
        streamUrl: stream.stream_url,
        replayUrl: stream.replay_url,
        viewerCount: stream.viewer_count,
        createdAt: stream.created_at,
        startedAt: stream.started_at,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/live] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

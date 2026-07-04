// ============================================================
// GET  /api/live — 라이브 방송 목록 조회
// POST /api/live — 라이브 방송 신규 등록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { IvsClient, CreateChannelCommand } from "@aws-sdk/client-ivs";

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
        ingestEndpoint: stream.ingest_endpoint || null,
        streamKey: stream.stream_key || null,
        channelArn: stream.channel_arn || null,
      };
    });

    return Response.json({ success: true, data: streams });
  } catch (err: any) {
    console.error("[GET /api/live] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

function cleanEnvValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Remove zero-width spaces, BOMs, and other control/non-printable characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, "");
  return cleaned;
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

    let finalStreamUrl = streamUrl;
    let ingestEndpoint = null;
    let streamKey = null;
    let channelArn = null;

    // AWS IVS 채널 자동 생성 로직 (스트리밍 주소가 명시적으로 들어오지 않고, AWS 키가 존재할 때)
    const awsAccessKeyId = cleanEnvValue(process.env.AWS_ACCESS_KEY_ID);
    const awsSecretAccessKey = cleanEnvValue(process.env.AWS_SECRET_ACCESS_KEY);
    const awsSessionToken = cleanEnvValue(process.env.AWS_SESSION_TOKEN);
    const awsRegion = cleanEnvValue(process.env.AWS_REGION) || "ap-northeast-2";

    const hasAwsKeys = !!(awsAccessKeyId && awsSecretAccessKey);
    if (hasAwsKeys && !finalStreamUrl) {
      try {
        const ivs = new IvsClient({
          region: awsRegion,
          credentials: {
            accessKeyId: awsAccessKeyId!,
            secretAccessKey: awsSecretAccessKey!,
            sessionToken: awsSessionToken,
          },
        });

        const command = new CreateChannelCommand({
          name: `modelbeauty-${Date.now()}`,
          latencyMode: "LOW", // 라이브 쇼핑에 맞는 초저지연 모드
          type: "BASIC",      // 요금 절감을 위한 원본 전송 BASIC 타입
        });

        const ivsResponse = await ivs.send(command);
        if (ivsResponse.channel && ivsResponse.streamKey) {
          finalStreamUrl = ivsResponse.channel.playbackUrl || null;
          ingestEndpoint = ivsResponse.channel.ingestEndpoint 
            ? `rtmps://${ivsResponse.channel.ingestEndpoint}:443/app/` 
            : null;
          streamKey = ivsResponse.streamKey.value || null;
          channelArn = ivsResponse.channel.arn || null;
        }
      } catch (awsErr: any) {
        console.error("[AWS IVS CreateChannel Error]:", awsErr);
        return Response.json({ 
          success: false, 
          error: `AWS IVS 방송 송출 채널을 자동 생성하지 못했습니다. 상세: ${awsErr.message ?? awsErr}` 
        }, { status: 500 });
      }
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
        stream_url: finalStreamUrl || null,
        replay_url: replayUrl || null,
        ingest_endpoint: ingestEndpoint,
        stream_key: streamKey,
        channel_arn: channelArn,
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
        ingestEndpoint: stream.ingest_endpoint,
        streamKey: stream.stream_key,
        channelArn: stream.channel_arn,
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

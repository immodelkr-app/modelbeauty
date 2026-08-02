// ============================================================
// PATCH /api/live/[id]/status — 라이브 방송 제어 (상태/소개상품 변경) (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, activeProductId, replayUrl, pinnedMessage } = body;

    const admin = createSupabaseAdmin();

    // ── 1. 현재 스트림 정보 조회 ────────────────────────────────
    const { data: stream, error: fetchError } = await admin
      .from("live_streams")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !stream) {
      return Response.json({ success: false, error: "방송을 찾을 수 없습니다." }, { status: 404 });
    }

    // ── 2. 업데이트 페이로드 작성 ──────────────────────────────
    const updatePayload: Record<string, unknown> = {};

    if (status !== undefined) {
      updatePayload.status = status;
      if (status === "live" && stream.status !== "live") {
        updatePayload.started_at = new Date().toISOString();
      } else if (status === "ended" && stream.status !== "ended") {
        updatePayload.ended_at = new Date().toISOString();
        // 종료될 때 activeProductId 초기화
        updatePayload.active_product_id = null;
      }
    }

    if (activeProductId !== undefined) {
      updatePayload.active_product_id = activeProductId;
    }

    if (replayUrl !== undefined) {
      updatePayload.replay_url = replayUrl;
    }

    if (pinnedMessage !== undefined) {
      updatePayload.pinned_message = pinnedMessage || null;
    }

    // ── 3. 상태 업데이트 수행 ──────────────────────────────────
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await admin
        .from("live_streams")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // ── 4. 방송 종료 시 상품 영상 자동 등록 처리 ───────────────
    const targetStatus = status || stream.status;
    const finalReplayUrl = replayUrl || stream.replay_url;

    if (targetStatus === "ended" && finalReplayUrl) {
      // 해당 라이브 방송에 연결된 모든 상품 조회
      const { data: mappedProducts, error: mapError } = await admin
        .from("live_stream_products")
        .select("product_id")
        .eq("stream_id", id);

      if (mapError) {
        console.error("Failed to fetch mapped products:", mapError);
      } else if (mappedProducts && mappedProducts.length > 0) {
        // 이미 등록된 영상이 있는지 확인 (중복 등록 방지)
        const { data: existingVideos } = await admin
          .from("product_videos")
          .select("product_id")
          .eq("stream_id", id);

        const existingProdIds = new Set((existingVideos ?? []).map((v) => v.product_id));

        const videoInserts = mappedProducts
          .map((p) => p.product_id)
          .filter((prodId) => !existingProdIds.has(prodId))
          .map((prodId) => ({
            product_id: prodId,
            stream_id: id,
            title: `${stream.title} — 다시보기`,
            video_url: finalReplayUrl,
            source_type: "live_replay",
            is_active: true,
          }));

        if (videoInserts.length > 0) {
          const { error: insertVideoError } = await admin
            .from("product_videos")
            .insert(videoInserts);

          if (insertVideoError) {
            console.error("Failed to auto-insert product replay videos:", insertVideoError);
          }
        }
      }
    }

    return Response.json({ success: true, message: "제어 상태 변경 완료" });
  } catch (err: any) {
    console.error("[PATCH /api/live/[id]/status] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

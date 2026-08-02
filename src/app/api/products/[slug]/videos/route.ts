// ============================================================
// GET  /api/products/[id]/videos — 상품 비디오 목록 조회 (Public)
// POST /api/products/[id]/videos — 상품 비디오 등록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: videos, error } = await supabase
      .from("product_videos")
      .select("*")
      .eq("product_id", id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formattedVideos = (videos ?? []).map((v) => ({
      id: v.id,
      productId: v.product_id,
      streamId: v.stream_id,
      title: v.title,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      sourceType: v.source_type,
      durationSec: v.duration_sec,
      sortOrder: v.sort_order,
      isActive: v.is_active,
      createdAt: v.created_at,
    }));

    return Response.json({ success: true, data: formattedVideos });
  } catch (err: any) {
    console.error("[GET /api/products/[id]/videos] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { slug: id } = await params;
    const body = await request.json();
    const { title, videoUrl, thumbnailUrl, durationSec, sortOrder = 0 } = body;

    if (!title || !videoUrl) {
      return Response.json({ success: false, error: "제목과 영상 URL은 필수입니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: newVideo, error } = await admin
      .from("product_videos")
      .insert({
        product_id: id,
        title,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || null,
        duration_sec: durationSec ? parseInt(durationSec, 10) : null,
        sort_order: parseInt(sortOrder, 10) || 0,
        source_type: "manual",
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return Response.json({
      success: true,
      data: {
        id: newVideo.id,
        productId: newVideo.product_id,
        title: newVideo.title,
        videoUrl: newVideo.video_url,
        thumbnailUrl: newVideo.thumbnail_url,
        sourceType: newVideo.source_type,
        durationSec: newVideo.duration_sec,
        sortOrder: newVideo.sort_order,
        isActive: newVideo.is_active,
        createdAt: newVideo.created_at,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/products/[id]/videos] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

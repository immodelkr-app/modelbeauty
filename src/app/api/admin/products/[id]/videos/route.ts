// ============================================================
// GET /api/admin/products/[id]/videos — 상품 비디오 전체 목록 조회 (Admin Only)
// 비활성(is_active=false) 영상도 포함해서 반환합니다.
// 공개용 /api/products/[id]/videos GET은 is_active=true만 반환하므로
// 관리자 화면에서는 반드시 이 엔드포인트를 사용해야 비활성화한 영상도 보이고 재활성화할 수 있습니다.
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();

    const { data: videos, error } = await admin
      .from("product_videos")
      .select("*")
      .eq("product_id", id)
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
  } catch (err) {
    console.error("[GET /api/admin/products/[id]/videos] Error:", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

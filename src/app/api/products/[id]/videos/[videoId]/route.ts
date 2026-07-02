// ============================================================
// PATCH  /api/products/[id]/videos/[videoId] — 상품 비디오 수정 (Admin Only)
// DELETE /api/products/[id]/videos/[videoId] — 상품 비디오 삭제 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id, videoId } = await params;
    const body = await request.json();
    const { title, videoUrl, thumbnailUrl, durationSec, sortOrder, isActive } = body;

    const admin = createSupabaseAdmin();

    const updatePayload: Record<string, unknown> = {};
    if (title !== undefined) updatePayload.title = title;
    if (videoUrl !== undefined) updatePayload.video_url = videoUrl;
    if (thumbnailUrl !== undefined) updatePayload.thumbnail_url = thumbnailUrl;
    if (durationSec !== undefined) updatePayload.duration_sec = durationSec ? parseInt(durationSec, 10) : null;
    if (sortOrder !== undefined) updatePayload.sort_order = parseInt(sortOrder, 10) || 0;
    if (isActive !== undefined) updatePayload.is_active = isActive;

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ success: false, error: "수정할 내용이 없습니다." }, { status: 400 });
    }

    const { error } = await admin
      .from("product_videos")
      .update(updatePayload)
      .eq("id", videoId)
      .eq("product_id", id);

    if (error) throw error;

    return Response.json({ success: true, message: "수정 완료" });
  } catch (err: any) {
    console.error("[PATCH /api/products/[id]/videos/[videoId]] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id, videoId } = await params;
    const admin = createSupabaseAdmin();

    const { error } = await admin
      .from("product_videos")
      .delete()
      .eq("id", videoId)
      .eq("product_id", id);

    if (error) throw error;

    return Response.json({ success: true, message: "삭제 완료" });
  } catch (err: any) {
    console.error("[DELETE /api/products/[id]/videos/[videoId]] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

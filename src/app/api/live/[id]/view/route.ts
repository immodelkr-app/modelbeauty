// ============================================================
// POST /api/live/[id]/view — 시청 시작/종료 시 viewer_count 증감
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const delta = body?.action === "leave" ? -1 : 1;

    const admin = createSupabaseAdmin();
    const { error } = await admin.rpc("adjust_viewer_count", {
      p_stream_id: id,
      p_delta: delta,
    });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/view] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

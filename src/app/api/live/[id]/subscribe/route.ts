// ============================================================
// GET    /api/live/[id]/subscribe — 내 구독 여부 + 전체 구독자 수 조회
// POST   /api/live/[id]/subscribe — 방송 시작 알림 구독
// DELETE /api/live/[id]/subscribe — 방송 시작 알림 구독 취소
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getMasterUserId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const masterUserId = await getMasterUserId(supabase);

    const { count } = await supabase
      .from("live_stream_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", id);

    let isSubscribed = false;
    if (masterUserId) {
      const { data } = await supabase
        .from("live_stream_subscriptions")
        .select("id")
        .eq("stream_id", id)
        .eq("master_user_id", masterUserId)
        .maybeSingle();
      isSubscribed = !!data;
    }

    return Response.json({ success: true, data: { isSubscribed, subscriberCount: count ?? 0 } });
  } catch (err: any) {
    console.error("[GET /api/live/[id]/subscribe] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const masterUserId = await getMasterUserId(supabase);
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { error } = await supabase
      .from("live_stream_subscriptions")
      .upsert({ stream_id: id, master_user_id: masterUserId }, { onConflict: "stream_id,master_user_id" });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/subscribe] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const masterUserId = await getMasterUserId(supabase);
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { error } = await supabase
      .from("live_stream_subscriptions")
      .delete()
      .eq("stream_id", id)
      .eq("master_user_id", masterUserId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/live/[id]/subscribe] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

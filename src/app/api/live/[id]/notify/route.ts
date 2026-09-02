// ============================================================
// POST /api/live/[id]/notify (Admin Only)
// 라이브 방송 시작 안내를 전체 회원에게 카카오 친구톡("아임모델" 채널) + 앱푸시로 발송한다.
// 관리자가 버튼을 눌러 수동으로만 발송한다 (자동 발송 아님).
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";
import { sendBroadcastNotify } from "@/lib/notify-broadcast";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: streamId } = await params;
    const admin = createSupabaseAdmin();

    const { data: stream, error: streamError } = await admin
      .from("live_streams")
      .select("title, description, streamer_name")
      .eq("id", streamId)
      .single();
    if (streamError || !stream) {
      return Response.json({ success: false, error: "방송을 찾을 수 없습니다." }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const linkUrl = `${origin}/live/${streamId}`;
    const friendTalkText = [
      `🔴 [모델뷰티] 라이브 방송 시작!`,
      stream.title,
      stream.description?.trim() || null,
      "",
      `지금 시청하기: ${linkUrl}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    let sentBy: string | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      sentBy = user?.email ?? null;
    } catch {
      sentBy = null;
    }

    const result = await sendBroadcastNotify({
      pushTitle: "🔴 라이브 방송 시작!",
      pushBody: stream.title,
      pushLinkUrl: `/live/${streamId}`,
      friendTalkText,
      sentBy,
    });

    await admin
      .from("live_streams")
      .update({ notify_sent_at: new Date().toISOString() })
      .eq("id", streamId);

    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/live/[id]/notify]", err);
    const message = err instanceof Error ? err.message : "서버 오류";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

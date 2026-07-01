// ============================================================
// GET  /api/live/[id]/chat — 라이브 채팅 이력 조회 (최신 50개)
// POST /api/live/[id]/chat — 라이브 채팅 메시지 등록 (Persist)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncMasterUser } from "@/lib/core-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: chats, error } = await supabase
      .from("live_stream_chats")
      .select("*")
      .eq("stream_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // 클라이언트 표시는 최신 메시지가 하단에 오도록 시간순으로 변환
    const formattedChats = (chats ?? [])
      .map((chat) => ({
        id: chat.id,
        streamId: chat.stream_id,
        masterUserId: chat.master_user_id,
        nickname: chat.nickname,
        message: chat.message,
        createdAt: chat.created_at,
      }))
      .reverse();

    return Response.json({ success: true, data: formattedChats });
  } catch (err: any) {
    console.error("[GET /api/live/[id]/chat] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return Response.json({ success: false, error: "메시지 내용을 입력해주세요." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    // ── 유저 정보 동기화 ──────────────────────────────────────
    let masterUserId = user.id;
    let nickname = user.user_metadata?.name ?? "사용자";

    if (user.phone) {
      try {
        const masterUser = await syncMasterUser({
          phoneNumber: user.phone,
          appName: "MODEL_BEAUTY",
          localUserId: user.id,
          name: user.user_metadata?.name,
        });
        masterUserId = masterUser.masterUserId;
        nickname = masterUser.name ?? nickname;
      } catch (coreAuthError) {
        console.warn("[POST /api/live/[id]/chat] im-core-auth sync failed, using fallback:", coreAuthError);
      }
    } else if (user.email) {
      nickname = user.user_metadata?.name ?? user.email.split("@")[0] ?? "관리자";
    }

    // ── 채팅 DB 저장 ─────────────────────────────────────────
    const { data: newChat, error: insertError } = await supabase
      .from("live_stream_chats")
      .insert({
        stream_id: id,
        master_user_id: masterUserId,
        nickname,
        message: message.trim(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return Response.json({
      success: true,
      data: {
        id: newChat.id,
        streamId: newChat.stream_id,
        masterUserId: newChat.master_user_id,
        nickname: newChat.nickname,
        message: newChat.message,
        createdAt: newChat.created_at,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/chat] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

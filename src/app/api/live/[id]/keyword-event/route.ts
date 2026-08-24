// ============================================================
// GET   /api/live/[id]/keyword-event — 현재/최근 선착순 댓글 이벤트 상태 조회 (키워드 미노출)
// POST  /api/live/[id]/keyword-event — 새 이벤트 시작 (Admin Only)
// PATCH /api/live/[id]/keyword-event — 진행 중인 이벤트 취소 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdmin();

    const { data: event } = await admin
      .from("live_keyword_events")
      .select("id, status, prize_label, winner_count, current_winners, created_at, ended_at")
      .eq("stream_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!event) {
      return Response.json({ success: true, data: null });
    }

    const { count: entryCount } = await admin
      .from("live_keyword_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);

    const { data: winnerEntries } = await admin
      .from("live_keyword_entries")
      .select("nickname, coupon_issue_status")
      .eq("event_id", event.id)
      .eq("is_winner", true)
      .order("created_at", { ascending: true });

    let myEntry: { isWinner: boolean } | null = null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
      const { data: entry } = await admin
        .from("live_keyword_entries")
        .select("is_winner")
        .eq("event_id", event.id)
        .eq("master_user_id", masterUserId)
        .maybeSingle();
      if (entry) myEntry = { isWinner: entry.is_winner };
    }

    return Response.json({
      success: true,
      data: {
        id: event.id,
        status: event.status,
        prizeLabel: event.prize_label,
        winnerCount: event.winner_count,
        currentWinners: event.current_winners,
        winners: (winnerEntries ?? []).map((w) => ({ nickname: w.nickname, couponIssueStatus: w.coupon_issue_status })),
        entryCount: entryCount ?? 0,
        createdAt: event.created_at,
        endedAt: event.ended_at,
        myEntry,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/live/[id]/keyword-event] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { keyword, prizeLabel, couponTemplateId, winnerCount } = body;

    const parsedWinnerCount = winnerCount == null ? 1 : Number(winnerCount);
    const cleanKeyword = typeof keyword === "string" ? keyword.trim() : "";

    if (!cleanKeyword || !prizeLabel || !Number.isInteger(parsedWinnerCount) || parsedWinnerCount < 1) {
      return Response.json({ success: false, error: "입력값을 확인해 주세요." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 동시에 진행 중인 이벤트는 하나만 허용 — 기존 진행중 이벤트는 취소 처리
    await admin
      .from("live_keyword_events")
      .update({ status: "cancelled" })
      .eq("stream_id", id)
      .eq("status", "active");

    const { data: newEvent, error } = await admin
      .from("live_keyword_events")
      .insert({
        stream_id: id,
        keyword: cleanKeyword,
        prize_label: prizeLabel,
        coupon_template_id: couponTemplateId || null,
        winner_count: parsedWinnerCount,
      })
      .select("id")
      .single();

    if (error) throw error;

    return Response.json({ success: true, data: { id: newEvent.id } });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/keyword-event] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { eventId } = body;

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("live_keyword_events")
      .update({ status: "cancelled" })
      .eq("id", eventId)
      .eq("stream_id", id)
      .eq("status", "active");

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/live/[id]/keyword-event] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

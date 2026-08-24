// ============================================================
// GET   /api/live/[id]/game — 현재/최근 게임 라운드 상태 조회 (정답 미노출)
// POST  /api/live/[id]/game — 새 라운드 시작 (Admin Only)
// PATCH /api/live/[id]/game — 진행 중인 라운드 취소 (Admin Only)
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

    const { data: round } = await admin
      .from("live_game_rounds")
      .select("id, status, min_value, max_value, prize_label, winner_count, current_winners, created_at, ended_at")
      .eq("stream_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!round) {
      return Response.json({ success: true, data: null });
    }

    const { count: entryCount } = await admin
      .from("live_game_entries")
      .select("id", { count: "exact", head: true })
      .eq("round_id", round.id);

    // 우승자 목록 (선착순 N명) — 정답 값은 절대 내려주지 않음
    const { data: winnerEntries } = await admin
      .from("live_game_entries")
      .select("nickname, coupon_issue_status")
      .eq("round_id", round.id)
      .eq("is_winner", true)
      .order("created_at", { ascending: true });

    // 로그인한 유저의 본인 제출 여부/결과 확인
    let myEntry: { guess: number; isCorrect: boolean; isWinner: boolean } | null = null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
      const { data: entry } = await admin
        .from("live_game_entries")
        .select("guess, is_correct, is_winner")
        .eq("round_id", round.id)
        .eq("master_user_id", masterUserId)
        .maybeSingle();
      if (entry) myEntry = { guess: entry.guess, isCorrect: entry.is_correct, isWinner: entry.is_winner };
    }

    return Response.json({
      success: true,
      data: {
        id: round.id,
        status: round.status,
        minValue: round.min_value,
        maxValue: round.max_value,
        prizeLabel: round.prize_label,
        winnerCount: round.winner_count,
        currentWinners: round.current_winners,
        winners: (winnerEntries ?? []).map((w) => ({ nickname: w.nickname, couponIssueStatus: w.coupon_issue_status })),
        entryCount: entryCount ?? 0,
        createdAt: round.created_at,
        endedAt: round.ended_at,
        myEntry,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/live/[id]/game] Error:", err);
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
    const { minValue, maxValue, answer, prizeLabel, couponTemplateId, winnerCount } = body;

    const parsedWinnerCount = winnerCount == null ? 1 : Number(winnerCount);

    if (
      typeof minValue !== "number" ||
      typeof maxValue !== "number" ||
      typeof answer !== "number" ||
      !prizeLabel ||
      minValue >= maxValue ||
      answer < minValue ||
      answer > maxValue ||
      !Number.isInteger(parsedWinnerCount) ||
      parsedWinnerCount < 1
    ) {
      return Response.json({ success: false, error: "입력값을 확인해 주세요." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 동시에 진행 중인 라운드는 하나만 허용 — 기존 진행중 라운드는 취소 처리
    await admin
      .from("live_game_rounds")
      .update({ status: "cancelled" })
      .eq("stream_id", id)
      .eq("status", "active");

    const { data: newRound, error } = await admin
      .from("live_game_rounds")
      .insert({
        stream_id: id,
        min_value: minValue,
        max_value: maxValue,
        answer,
        prize_label: prizeLabel,
        coupon_template_id: couponTemplateId || null,
        winner_count: parsedWinnerCount,
      })
      .select("id")
      .single();

    if (error) throw error;

    return Response.json({ success: true, data: { id: newRound.id } });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/game] Error:", err);
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
    const { roundId } = body;

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("live_game_rounds")
      .update({ status: "cancelled" })
      .eq("id", roundId)
      .eq("stream_id", id)
      .eq("status", "active");

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/live/[id]/game] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// POST /api/live/[id]/game/guess — 숫자 맞추기 정답 제출
// 라운드당 1인 1회, 선착순 winner_count명까지 우승 처리 (원자적 슬롯 선점으로 동시성 보장)
// 우승 시 쿠폰 템플릿이 지정되어 있으면 아임모델 공화국에 자동 발급 요청 (우승자별 발급 상태 기록)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { issueCoupon } from "@/lib/core-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { roundId, guess } = body;

    if (typeof guess !== "number" || !roundId) {
      return Response.json({ success: false, error: "잘못된 요청입니다." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const nickname = user.user_metadata?.name ?? "고객";

    const admin = createSupabaseAdmin();

    const { data: round, error: roundError } = await admin
      .from("live_game_rounds")
      .select("*")
      .eq("id", roundId)
      .eq("stream_id", id)
      .single();

    if (roundError || !round) {
      return Response.json({ success: false, error: "게임을 찾을 수 없습니다." }, { status: 404 });
    }
    if (round.status !== "active") {
      return Response.json({ success: false, error: "이미 종료된 게임입니다." }, { status: 400 });
    }
    if (guess < round.min_value || guess > round.max_value) {
      return Response.json({ success: false, error: `${round.min_value}~${round.max_value} 사이의 숫자를 입력해 주세요.` }, { status: 400 });
    }

    const isCorrect = guess === round.answer;

    const { error: insertError } = await admin.from("live_game_entries").insert({
      round_id: roundId,
      master_user_id: masterUserId,
      nickname,
      guess,
      is_correct: isCorrect,
    });

    if (insertError) {
      // UNIQUE(round_id, master_user_id) 위반 = 이미 참여함
      if (insertError.code === "23505") {
        return Response.json({ success: false, error: "이미 이 게임에 참여하셨습니다." }, { status: 409 });
      }
      throw insertError;
    }

    if (!isCorrect) {
      return Response.json({ success: true, data: { isCorrect: false, isWinner: false } });
    }

    // 선착순 N명 우승 슬롯을 원자적으로 선점 (동시 요청도 정확히 winner_count명만 통과)
    const { data: claimRows, error: claimError } = await admin.rpc("claim_live_game_winner_slot", {
      p_round_id: roundId,
    });

    if (claimError) throw claimError;

    const claimResult = (claimRows?.[0] as
      | {
          claimed: boolean;
          winner_rank: number | null;
          winner_count: number | null;
          round_ended: boolean;
          coupon_template_id: string | null;
          prize_label: string | null;
        }
      | undefined) ?? null;

    if (!claimResult?.claimed) {
      // 정답은 맞았지만 이미 우승 인원이 마감됨
      return Response.json({ success: true, data: { isCorrect: true, isWinner: false } });
    }

    await admin
      .from("live_game_entries")
      .update({ is_winner: true })
      .eq("round_id", roundId)
      .eq("master_user_id", masterUserId);

    let couponIssueStatus: "issued" | "failed" | "not_applicable" = "not_applicable";
    if (claimResult.coupon_template_id) {
      try {
        await issueCoupon({
          masterUserId,
          couponTemplateId: claimResult.coupon_template_id,
          issuedBy: "model_beauty_live_game",
        });
        couponIssueStatus = "issued";
      } catch (couponError) {
        console.error("[POST /api/live/[id]/game/guess] 쿠폰 자동 발급 실패:", couponError);
        couponIssueStatus = "failed";
      }
      await admin
        .from("live_game_entries")
        .update({ coupon_issue_status: couponIssueStatus })
        .eq("round_id", roundId)
        .eq("master_user_id", masterUserId);
    }

    return Response.json({
      success: true,
      data: {
        isCorrect: true,
        isWinner: true,
        prizeLabel: claimResult.prize_label,
        winnerRank: claimResult.winner_rank,
        winnerCount: claimResult.winner_count,
        couponIssueStatus,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/game/guess] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

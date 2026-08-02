// ============================================================
// POST /api/live/[id]/game/guess — 숫자 맞추기 정답 제출
// 라운드당 1인 1회, 최초 정답자만 우승 처리 (조건부 UPDATE로 동시성 보장)
// 우승 시 쿠폰 템플릿이 지정되어 있으면 아임모델 공화국에 자동 발급 요청
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

    // 최초 정답자만 우승 처리 — status='active' 조건부 UPDATE라 동시 요청 중 하나만 성공
    const { data: wonRound } = await admin
      .from("live_game_rounds")
      .update({
        status: "ended",
        winner_master_user_id: masterUserId,
        winner_nickname: nickname,
        ended_at: new Date().toISOString(),
      })
      .eq("id", roundId)
      .eq("status", "active")
      .select("id, coupon_template_id, prize_label")
      .maybeSingle();

    if (!wonRound) {
      // 정답은 맞았지만 이미 다른 사람이 먼저 맞혀 라운드가 마감됨
      return Response.json({ success: true, data: { isCorrect: true, isWinner: false } });
    }

    let couponIssueStatus: "issued" | "failed" | "not_applicable" = "not_applicable";
    if (wonRound.coupon_template_id) {
      try {
        await issueCoupon({
          masterUserId,
          couponTemplateId: wonRound.coupon_template_id,
          issuedBy: "model_beauty_live_game",
        });
        couponIssueStatus = "issued";
      } catch (couponError) {
        console.error("[POST /api/live/[id]/game/guess] 쿠폰 자동 발급 실패:", couponError);
        couponIssueStatus = "failed";
      }
      await admin
        .from("live_game_rounds")
        .update({ coupon_issue_status: couponIssueStatus })
        .eq("id", roundId);
    }

    return Response.json({
      success: true,
      data: {
        isCorrect: true,
        isWinner: true,
        prizeLabel: wonRound.prize_label,
        couponIssueStatus,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/game/guess] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

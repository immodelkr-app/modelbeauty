-- ============================================================
-- 모델뷰티: 라이브커머스 미니게임 — 선착순 N명 우승 지원
-- Migration: 00022_live_game_multi_winner
-- ============================================================
-- 기존에는 최초 정답자 1명만 우승했으나, 관리자가 라운드 시작 시
-- 우승 인원수(winner_count)를 지정할 수 있도록 확장한다.
-- 우승자별로 쿠폰 발급 성공/실패가 다를 수 있으므로 발급 상태를
-- entries 테이블로 이동(라운드 단일 컬럼 → 우승자별 컬럼).

SET search_path = model_beauty, public;

ALTER TABLE live_game_rounds
    ADD COLUMN winner_count    INTEGER NOT NULL DEFAULT 1 CHECK (winner_count >= 1),
    ADD COLUMN current_winners INTEGER NOT NULL DEFAULT 0;

ALTER TABLE live_game_entries
    ADD COLUMN is_winner           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN coupon_issue_status TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (coupon_issue_status IN ('not_applicable', 'pending', 'issued', 'failed'));

CREATE INDEX idx_live_game_entries_round_winner ON live_game_entries(round_id) WHERE is_winner;

-- 정답 제출 시 "우승 슬롯"을 원자적으로 선점하는 함수.
-- current_winners < winner_count 이고 status='active'인 동안에만 슬롯을 내주며,
-- 동시 요청은 행 잠금(EvalPlanQual 재평가)으로 직렬화되어 정확히 winner_count명만 통과한다.
-- 마지막 슬롯을 채우면 라운드를 즉시 'ended'로 전환한다.
CREATE OR REPLACE FUNCTION model_beauty.claim_live_game_winner_slot(p_round_id UUID)
RETURNS TABLE(
    claimed             BOOLEAN,
    winner_rank         INTEGER,
    winner_count        INTEGER,
    round_ended         BOOLEAN,
    coupon_template_id  TEXT,
    prize_label         TEXT
)
LANGUAGE plpgsql
SET search_path = model_beauty, public
AS $$
DECLARE
    v_current  INTEGER;
    v_limit    INTEGER;
    v_status   TEXT;
    v_coupon   TEXT;
    v_prize    TEXT;
BEGIN
    UPDATE model_beauty.live_game_rounds r
    SET current_winners = r.current_winners + 1,
        status     = CASE WHEN r.current_winners + 1 >= r.winner_count THEN 'ended' ELSE r.status END,
        ended_at   = CASE WHEN r.current_winners + 1 >= r.winner_count THEN now() ELSE r.ended_at END
    WHERE r.id = p_round_id
      AND r.status = 'active'
      AND r.current_winners < r.winner_count
    RETURNING r.current_winners, r.winner_count, r.status, r.coupon_template_id, r.prize_label
    INTO v_current, v_limit, v_status, v_coupon, v_prize;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::INTEGER, NULL::INTEGER, false, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, v_current, v_limit, (v_status = 'ended'), v_coupon, v_prize;
END;
$$;

GRANT EXECUTE ON FUNCTION model_beauty.claim_live_game_winner_slot(UUID) TO service_role;

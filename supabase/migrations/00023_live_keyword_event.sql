-- ============================================================
-- 모델뷰티: 라이브커머스 미니게임 — 선착순 댓글(키워드) 이벤트
-- Migration: 00023_live_keyword_event
-- ============================================================
-- 숫자 맞추기(live_game_rounds)와 별개로, 방송에서 구두로 안내한 키워드를
-- 실시간 채팅에 가장 먼저 입력한 N명이 당첨되는 이벤트. 참여는 별도 UI 없이
-- 기존 채팅 전송 그대로 이루어지며, 채팅 메시지가 키워드와 일치할 때만
-- entries에 기록된다. RLS는 활성화만 하고 공개 정책은 두지 않아 keyword
-- 컬럼이 anon 키로 직접 노출되지 않도록 하고, 모든 접근은 API 라우트에서
-- service role로만 수행한다.

SET search_path = model_beauty, public;

CREATE TABLE live_keyword_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id           UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'ended', 'cancelled')),
    keyword             TEXT NOT NULL,
    prize_label         TEXT NOT NULL,
    coupon_template_id  TEXT,
    winner_count        INTEGER NOT NULL DEFAULT 1 CHECK (winner_count >= 1),
    current_winners     INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    ended_at            TIMESTAMPTZ
);

CREATE INDEX idx_live_keyword_events_stream ON live_keyword_events(stream_id, created_at DESC);

CREATE TABLE live_keyword_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES live_keyword_events(id) ON DELETE CASCADE,
    master_user_id      UUID NOT NULL,
    nickname            TEXT NOT NULL,
    is_winner           BOOLEAN NOT NULL DEFAULT false,
    coupon_issue_status TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (coupon_issue_status IN ('not_applicable', 'pending', 'issued', 'failed')),
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, master_user_id)
);

CREATE INDEX idx_live_keyword_entries_event ON live_keyword_entries(event_id);

ALTER TABLE live_keyword_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_keyword_entries ENABLE ROW LEVEL SECURITY;

-- 선착순 N명 우승 슬롯을 원자적으로 선점하는 함수 (claim_live_game_winner_slot과 동일 패턴)
CREATE OR REPLACE FUNCTION model_beauty.claim_live_keyword_winner_slot(p_event_id UUID)
RETURNS TABLE(
    claimed             BOOLEAN,
    winner_rank         INTEGER,
    winner_count        INTEGER,
    event_ended         BOOLEAN,
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
    UPDATE model_beauty.live_keyword_events e
    SET current_winners = e.current_winners + 1,
        status     = CASE WHEN e.current_winners + 1 >= e.winner_count THEN 'ended' ELSE e.status END,
        ended_at   = CASE WHEN e.current_winners + 1 >= e.winner_count THEN now() ELSE e.ended_at END
    WHERE e.id = p_event_id
      AND e.status = 'active'
      AND e.current_winners < e.winner_count
    RETURNING e.current_winners, e.winner_count, e.status, e.coupon_template_id, e.prize_label
    INTO v_current, v_limit, v_status, v_coupon, v_prize;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::INTEGER, NULL::INTEGER, false, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, v_current, v_limit, (v_status = 'ended'), v_coupon, v_prize;
END;
$$;

GRANT EXECUTE ON FUNCTION model_beauty.claim_live_keyword_winner_slot(UUID) TO service_role;

-- ============================================================
-- 모델뷰티: 라이브커머스 미니게임 (숫자 맞추기)
-- Migration: 00016_live_number_game
-- ============================================================

SET search_path = model_beauty, public;

CREATE TABLE live_game_rounds (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id              UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    status                 TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'ended', 'cancelled')),
    min_value              INTEGER NOT NULL,
    max_value              INTEGER NOT NULL,
    answer                 INTEGER NOT NULL,
    prize_label            TEXT NOT NULL,
    coupon_template_id     TEXT,
    winner_master_user_id  UUID,
    winner_nickname        TEXT,
    coupon_issue_status    TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (coupon_issue_status IN ('not_applicable', 'pending', 'issued', 'failed')),
    created_at             TIMESTAMPTZ DEFAULT now(),
    ended_at               TIMESTAMPTZ
);

CREATE INDEX idx_live_game_rounds_stream ON live_game_rounds(stream_id, created_at DESC);

CREATE TABLE live_game_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id       UUID NOT NULL REFERENCES live_game_rounds(id) ON DELETE CASCADE,
    master_user_id UUID NOT NULL,
    nickname       TEXT NOT NULL,
    guess          INTEGER NOT NULL,
    is_correct     BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_id, master_user_id)
);

CREATE INDEX idx_live_game_entries_round ON live_game_entries(round_id);

-- RLS 활성화만 하고 공개 정책은 두지 않음: answer 컬럼이 anon 키로 직접 조회되면
-- 게임이 무의미해지므로, 모든 접근은 API 라우트에서 service role(createSupabaseAdmin)로만 수행.
ALTER TABLE live_game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_game_entries ENABLE ROW LEVEL SECURITY;

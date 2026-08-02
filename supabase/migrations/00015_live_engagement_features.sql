-- ============================================================
-- 모델뷰티: 라이브커머스 재미/판매효율 기능 추가
-- Migration: 00015_live_engagement_features
-- (핀 공지, 상품별 라이브 특가 타임세일, 방송 알림 구독)
-- ============================================================

SET search_path = model_beauty, public;

-- ── 채팅 핀 공지 (호스트 고정 메시지) ─────────────────────────

ALTER TABLE live_streams ADD COLUMN pinned_message TEXT;

-- ── 상품별 라이브 특가(타임세일) 표시 ──────────────────────────

ALTER TABLE live_stream_products ADD COLUMN is_live_deal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE live_stream_products ADD COLUMN deal_ends_at TIMESTAMPTZ;

-- ── 방송 시작 알림 구독 ────────────────────────────────────────

CREATE TABLE live_stream_subscriptions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id      UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    master_user_id UUID NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE(stream_id, master_user_id)
);

CREATE INDEX idx_live_stream_subscriptions_stream ON live_stream_subscriptions(stream_id);

ALTER TABLE live_stream_subscriptions ENABLE ROW LEVEL SECURITY;

-- 조회는 공개(구독자 수 집계용), 등록/삭제는 API 라우트에서 로그인 세션으로 검증
-- (live_stream_chats와 동일한 패턴 — 커스텀 인증이라 auth.uid() 매핑이 없음)
CREATE POLICY "누구나 알림 구독 조회" ON live_stream_subscriptions FOR SELECT USING (true);
CREATE POLICY "로그인한 유저는 알림 구독 등록 가능" ON live_stream_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "로그인한 유저는 알림 구독 취소 가능" ON live_stream_subscriptions FOR DELETE USING (true);

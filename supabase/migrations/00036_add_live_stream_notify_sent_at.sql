-- ============================================================
-- 라이브 방송 시작 안내(친구톡+앱푸시) 마지막 수동 발송 시각 기록
-- Migration: 00036_add_live_stream_notify_sent_at
-- ============================================================

SET search_path = model_beauty, public;

ALTER TABLE live_streams
    ADD COLUMN notify_sent_at TIMESTAMPTZ;

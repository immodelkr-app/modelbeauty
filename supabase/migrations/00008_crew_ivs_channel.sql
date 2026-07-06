-- ============================================================
-- 모델뷰티: 크루별 전용 IVS 채널 정보 컬럼 추가
-- Migration: 00008_crew_ivs_channel
-- ============================================================

SET search_path = model_beauty, public;

-- ── live_crews 테이블에 전용 IVS 채널 정보 추가 ──────────────
ALTER TABLE live_crews
  ADD COLUMN IF NOT EXISTS ivs_channel_arn    TEXT,
  ADD COLUMN IF NOT EXISTS ivs_ingest_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS ivs_stream_key      TEXT,
  ADD COLUMN IF NOT EXISTS ivs_playback_url    TEXT;

COMMENT ON COLUMN live_crews.ivs_channel_arn     IS '크루 전용 AWS IVS 채널 ARN';
COMMENT ON COLUMN live_crews.ivs_ingest_endpoint IS 'RTMPS 송출 주소 (프리즘 앱에 1회 입력)';
COMMENT ON COLUMN live_crews.ivs_stream_key      IS '크루 전용 스트림 키 (프리즘 앱에 1회 입력)';
COMMENT ON COLUMN live_crews.ivs_playback_url    IS 'HLS 재생 주소 (방송 등록 시 자동 사용)';

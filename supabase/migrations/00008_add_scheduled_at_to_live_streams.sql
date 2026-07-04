-- ============================================================
-- 모델뷰티: live_streams 테이블에 scheduled_at 컬럼 추가
-- Migration: 00008_add_scheduled_at_to_live_streams
-- ============================================================
-- scheduled_at: 관리자가 지정하는 방송 예정 일시(방송 시작 전 편성 기준)
-- started_at과 달리, 방송이 실제 ON-AIR 되기 전에 미리 입력하는 예고 시간

SET search_path = model_beauty, public;

ALTER TABLE live_streams
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 기존 scheduled_at이 없는 upcoming 방송은 created_at을 fallback으로 사용하므로
-- NOT NULL 제약 없이 Nullable로 추가합니다.

CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled_at
  ON live_streams(scheduled_at);

COMMENT ON COLUMN live_streams.scheduled_at IS
  '관리자가 등록하는 방송 예정 일시 (upcoming 상태의 편성 기준 시각). NULL이면 미정.';

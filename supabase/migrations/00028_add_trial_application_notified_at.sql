-- ============================================================
-- 모델뷰티: 체험단 신청에 선정 알림 발송 시각 컬럼 추가
-- Migration: 00028_add_trial_application_notified_at
-- ============================================================
-- 어드민이 "선정" 처리하면 앱푸시+문자를 자동 발송하는데, 언제 보냈는지
-- 기록해서 중복 발송 여부를 화면에서 바로 확인할 수 있게 한다.

SET search_path TO model_beauty, public;

ALTER TABLE trial_applications
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

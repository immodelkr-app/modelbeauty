-- ============================================================
-- 모델뷰티: 체험단 후기 리마인드 발송 이력 컬럼 추가
-- Migration: 00035_add_trial_application_review_reminded_at
-- ============================================================
-- 선정된 신청자가 아직 체험 후기를 안 올렸을 때, 관리자가 신청자 목록에서
-- 버튼 클릭으로 앱푸시+문자 리마인드를 보낼 수 있게 한다. 마지막 발송 시각을
-- 기록해 관리자 화면에 "마지막 리마인드: n일 전"으로 보여준다.

SET search_path TO model_beauty, public;

ALTER TABLE trial_applications
    ADD COLUMN review_reminded_at TIMESTAMPTZ;

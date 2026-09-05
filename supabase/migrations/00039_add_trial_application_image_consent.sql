-- ============================================================
-- 모델뷰티: 체험단 신청서에 초상권/콘텐츠(사진·영상) 사용 동의 컬럼 추가
-- (신청 시점에 콘텐츠 활용 동의 여부와 동의 시각을 함께 기록)
-- Migration: 00039_add_trial_application_image_consent
-- ============================================================

SET search_path TO model_beauty, public;

ALTER TABLE trial_applications
    ADD COLUMN consent_image_usage BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN consent_agreed_at TIMESTAMPTZ;

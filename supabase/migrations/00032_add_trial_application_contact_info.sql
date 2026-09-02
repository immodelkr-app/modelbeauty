-- ============================================================
-- 모델뷰티: 체험단 신청서에 배송/연락처/SNS 정보 컬럼 추가
-- (선정 시 실제 제품 발송·연락에 필요한 정보를 신청 시점에 함께 수집)
-- Migration: 00032_add_trial_application_contact_info
-- ============================================================

SET search_path TO model_beauty, public;

ALTER TABLE trial_applications
    ALTER COLUMN channel_url DROP NOT NULL,
    ADD COLUMN applicant_name TEXT,
    ADD COLUMN applicant_phone TEXT,
    ADD COLUMN address_zipcode TEXT,
    ADD COLUMN address_main TEXT,
    ADD COLUMN address_detail TEXT,
    ADD COLUMN youtube_channel TEXT,
    ADD COLUMN instagram_id TEXT;

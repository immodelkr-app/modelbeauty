-- ============================================================
-- 모델뷰티: 체험단 모집 안내 카카오 친구톡 발송 이력 컬럼 추가
-- Migration: 00030_add_trial_campaign_friendtalk_sent_at
-- ============================================================

SET search_path TO model_beauty, public;

ALTER TABLE trial_campaigns
    ADD COLUMN friendtalk_sent_at TIMESTAMPTZ;

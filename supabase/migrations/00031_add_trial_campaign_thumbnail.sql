-- ============================================================
-- 모델뷰티: 체험단 캠페인 전용 포스터 썸네일 컬럼 추가
-- (미설정 시 기존처럼 연결된 상품 이미지를 대체 사용)
-- Migration: 00031_add_trial_campaign_thumbnail
-- ============================================================

SET search_path TO model_beauty, public;

ALTER TABLE trial_campaigns
    ADD COLUMN thumbnail TEXT;

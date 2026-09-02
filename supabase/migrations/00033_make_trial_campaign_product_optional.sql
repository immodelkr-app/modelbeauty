-- ============================================================
-- 모델뷰티: 체험단 캠페인의 상품 연결을 선택사항으로 변경
-- Migration: 00033_make_trial_campaign_product_optional
-- ============================================================
-- 상품이 아직 등록되기 전에도 체험단 모집을 먼저 진행할 수 있어야 한다는
-- 운영 요구사항에 따라, trial_campaigns.product_id를 NULL 허용으로 변경한다.
-- (products 삭제 시 연결된 캠페인도 함께 삭제되는 ON DELETE CASCADE는 유지)

SET search_path TO model_beauty, public;

ALTER TABLE trial_campaigns
    ALTER COLUMN product_id DROP NOT NULL;

-- ============================================================
-- 모델뷰티: 리뷰 포인트 지급 이력 컬럼 추가
-- Migration: 00025_add_review_points_granted
-- ============================================================
-- 리뷰 작성 포인트는 자동 지급이 아니라 어드민이 리뷰 관리 화면에서
-- 건별로 금액을 정해 수동 지급한다 (품질/SNS 링크 첨부 여부 등을 보고 차등).
-- 지급 자체는 기존 im-core-auth 포인트 지급 API(rewardPoints)를 그대로 쓰고,
-- 이 컬럼은 "이미 얼마를 지급했는지" 리뷰 화면에서 바로 보이게 하는 용도.

SET search_path TO model_beauty, public;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS points_granted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_granted_at TIMESTAMPTZ;

-- ============================================================
-- 모델뷰티: products 테이블에 추천 크루 컬럼 추가
-- Migration: 00009_add_recommender_to_products
-- ============================================================

SET search_path = model_beauty, public;

-- ── 추천 크루 컬럼 추가 ──────────────────────────────────────
ALTER TABLE products
  ADD COLUMN recommender_crew_id UUID
    REFERENCES live_crews(id) ON DELETE SET NULL,
  ADD COLUMN recommendation_note TEXT;   -- 추천 한마디 (최대 150자 권고)

-- 인덱스: 특정 크루가 추천한 상품 목록 조회 최적화
CREATE INDEX idx_products_recommender_crew
  ON products(recommender_crew_id);

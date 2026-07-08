-- ============================================================
-- Migration: 00011_add_default_cost_price.sql
-- vendors 테이블에 기본 고정 공급가 금액 컬럼 추가
-- ============================================================

ALTER TABLE model_beauty.vendors
  ADD COLUMN IF NOT EXISTS default_cost_price INTEGER NOT NULL DEFAULT 0
    CHECK (default_cost_price >= 0);

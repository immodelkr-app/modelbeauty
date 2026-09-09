-- 포인트몰: 특정 카테고리를 "일정기간 동안 포인트로 50%/100% 결제 가능" 상태로 운영하기 위한 컬럼
-- - categories.is_point_mall: 포인트몰 전용 카테고리 여부
-- - categories.point_period_starts_at / ends_at: 활동기간 (이 기간 밖이면 프론트에서 "포인트 사용기간이 아닙니다" 안내)
-- - products.point_ratio: 포인트몰 카테고리 소속 상품의 포인트 사용 한도(50 또는 100). 일반 상품은 NULL.

SET search_path TO model_beauty, public;

ALTER TABLE categories
    ADD COLUMN is_point_mall BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN point_period_starts_at TIMESTAMPTZ,
    ADD COLUMN point_period_ends_at TIMESTAMPTZ;

ALTER TABLE products
    ADD COLUMN point_ratio SMALLINT CHECK (point_ratio IS NULL OR point_ratio IN (50, 100));

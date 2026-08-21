-- 상품:카테고리 다대다 관계 지원용 조인 테이블
-- products.category_id(단일 FK)는 "대표 카테고리"로 계속 유지하고,
-- 실제 다중 카테고리 소속 여부는 이 테이블이 정본(source of truth)이다.
CREATE TABLE product_categories (
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_category ON product_categories(category_id);
CREATE INDEX idx_product_categories_product ON product_categories(product_id);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 상품-카테고리 매핑 조회" ON product_categories
  FOR SELECT USING (true);

-- 기존 단일 category_id 값을 매핑 테이블로 백필
INSERT INTO product_categories (product_id, category_id)
SELECT id, category_id FROM products WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

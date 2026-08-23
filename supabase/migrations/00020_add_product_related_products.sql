-- 상품별 연관상품(수동 지정) 테이블
-- 지금까지 상품 상세페이지의 "연관 상품"은 같은 카테고리 상품을 자동으로 보여주는 방식이었다.
-- 이 테이블은 관리자가 직접 지정한 연관상품을 담고, 지정된 것이 있으면 그것을 우선 노출한다.
CREATE TABLE product_related_products (
    product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    related_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, related_product_id),
    CHECK (product_id <> related_product_id)
);

CREATE INDEX idx_product_related_products_product ON product_related_products(product_id);

ALTER TABLE product_related_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 연관상품 매핑 조회" ON product_related_products
  FOR SELECT USING (true);

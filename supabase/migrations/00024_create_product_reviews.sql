-- ============================================================
-- 모델뷰티: 상품 리뷰 테이블 생성 (Phase 1 — 구매자 리뷰)
-- Migration: 00024_create_product_reviews
-- ============================================================
-- 인증 경로: 지금은 실제 배송완료된 주문(order_id)에 연결된 리뷰만 허용.
-- 체험단 리뷰(trial_application_id)는 체험단 모집 기능(Phase 2)과 함께
-- 별도 마이그레이션에서 컬럼을 추가하고 order_id를 nullable로 완화한다.

SET search_path TO model_beauty, public;

CREATE TABLE product_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    master_user_id  UUID NOT NULL,
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    images          JSONB NOT NULL DEFAULT '[]',       -- [{ url: "..." }, ...]
    external_link   TEXT,                               -- 블로그/유튜브/인스타 포스팅 링크 (선택)

    is_hidden       BOOLEAN NOT NULL DEFAULT false,
    hidden_reason   TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (order_id, product_id)                        -- 같은 주문·상품에 중복 리뷰 방지
);

CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user ON product_reviews(master_user_id);
CREATE INDEX idx_product_reviews_created ON product_reviews(created_at DESC);

CREATE TRIGGER trigger_product_reviews_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS 정책 ──────────────────────────────────────────────
-- 공개 조회는 숨김 처리되지 않은 리뷰만, 쓰기는 서비스 롤(API 라우트)에서만 처리

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 공개 리뷰 조회" ON product_reviews
    FOR SELECT USING (is_hidden = false);

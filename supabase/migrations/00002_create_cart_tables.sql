-- ============================================================
-- 모델뷰티: 장바구니/위시리스트 테이블 생성
-- Migration: 00002_create_cart_tables
-- ============================================================
-- NOTE: master_user_id는 im-core-auth의 master_users.id를 참조하지만
--       별도 Supabase 프로젝트이므로 FK를 걸 수 없음.
--       애플리케이션 레벨에서 유효성을 검증합니다.

-- ── 장바구니 ──────────────────────────────────────────────

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id  UUID NOT NULL,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(master_user_id, product_id, variant_id)
);

CREATE INDEX idx_cart_items_user ON cart_items(master_user_id);

CREATE TRIGGER trigger_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 위시리스트 ─────────────────────────────────────────────

CREATE TABLE wishlist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id  UUID NOT NULL,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(master_user_id, product_id)
);

CREATE INDEX idx_wishlist_items_user ON wishlist_items(master_user_id);

-- ── RLS 정책 ──────────────────────────────────────────────
-- 장바구니/위시리스트는 서비스 롤(서버)만 접근 가능
-- (클라이언트 직접 접근 없음 — 모든 조작은 API 라우트를 통해)

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 모델뷰티: 주문/결제 테이블 생성
-- Migration: 00003_create_order_tables
-- ============================================================
-- 주문 상태 흐름:
--   pending → paid → preparing → shipping → delivered → confirmed
--   pending → cancelled
--   delivered → refund_requested → refunded

-- ── 주문 ──────────────────────────────────────────────────

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        TEXT UNIQUE NOT NULL,           -- 표시용: MB-20260627-XXXX
    master_user_id      UUID NOT NULL,

    -- 주문 금액
    subtotal            INTEGER NOT NULL,               -- 상품 합계
    shipping_fee        INTEGER NOT NULL DEFAULT 0,     -- 배송비
    point_discount      INTEGER NOT NULL DEFAULT 0,     -- 포인트 할인액
    coupon_discount     INTEGER NOT NULL DEFAULT 0,     -- 쿠폰 할인액
    total_amount        INTEGER NOT NULL,               -- 최종 결제 금액

    -- 결제 정보 (토스페이먼츠)
    payment_key         TEXT,                           -- 토스페이먼츠 paymentKey
    payment_method      TEXT,                           -- card, bank_transfer, etc.
    payment_status      TEXT DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    paid_at             TIMESTAMPTZ,

    -- 배송지 정보
    recipient_name      TEXT NOT NULL,
    recipient_phone     TEXT NOT NULL,
    address_zipcode     TEXT NOT NULL,
    address_main        TEXT NOT NULL,
    address_detail      TEXT,
    delivery_memo       TEXT,

    -- 사용된 포인트/쿠폰 추적 (환불 복원용)
    used_point_amount   INTEGER DEFAULT 0,
    used_coupon_id      TEXT,                           -- im-core-auth user_coupons.id
    used_coupon_code    TEXT,

    -- 주문 상태
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'paid', 'preparing', 'shipping',
            'delivered', 'confirmed', 'cancelled',
            'refund_requested', 'refunded'
        )),

    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_master_user ON orders(master_user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_key ON orders(payment_key);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 주문 상품 (주문 시점 스냅샷) ──────────────────────────

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    variant_id      UUID REFERENCES product_variants(id),
    product_name    TEXT NOT NULL,                      -- 스냅샷
    variant_info    JSONB,                              -- 스냅샷 {"색상":"레드","사이즈":"M"}
    unit_price      INTEGER NOT NULL,                   -- 구매 시점 단가
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    subtotal        INTEGER NOT NULL,                   -- unit_price × quantity
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ── 주문 상태 이력 ──────────────────────────────────────────

CREATE TABLE order_status_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    changed_by  TEXT,                                   -- 'system', 'admin', 'user'
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- ── RLS 정책 ──────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- 주문 데이터는 서비스 롤(서버)만 접근 가능

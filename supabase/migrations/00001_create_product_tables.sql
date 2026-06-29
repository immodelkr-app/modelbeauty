-- ============================================================
-- 모델뷰티: 상품/카테고리 테이블 생성
-- Migration: 00001_create_product_tables
-- ============================================================

-- ── 카테고리 ───────────────────────────────────────────────

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order  INTEGER DEFAULT 0,
    image_url   TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ── 상품 ──────────────────────────────────────────────────

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    description     TEXT,
    content         TEXT,                           -- 상세 설명 (HTML/Markdown)
    base_price      INTEGER NOT NULL CHECK (base_price >= 0),
    sale_price      INTEGER CHECK (sale_price >= 0),
    stock_quantity  INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    sku             TEXT UNIQUE,
    images          JSONB DEFAULT '[]',             -- [{url, alt, sort_order}]
    tags            TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT true,
    is_featured     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- ── 상품 옵션 (색상, 사이즈 등) ────────────────────────────

CREATE TABLE product_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                      -- '색상', '사이즈' 등
    values      JSONB NOT NULL DEFAULT '[]',        -- ["레드", "블루", "블랙"]
    sort_order  INTEGER DEFAULT 0
);

CREATE INDEX idx_product_options_product ON product_options(product_id);

-- ── 상품 변형 (옵션 조합별 재고/가격) ──────────────────────

CREATE TABLE product_variants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    option_values    JSONB NOT NULL,                -- {"색상": "레드", "사이즈": "M"}
    sku              TEXT UNIQUE,
    price_adjustment INTEGER DEFAULT 0,             -- base_price 대비 가/감액
    stock_quantity   INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);

-- ── updated_at 자동 갱신 함수 ─────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS 정책 ──────────────────────────────────────────────
-- 공개 상품 조회는 누구나 가능, 수정은 서비스 롤만

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- 공개 조회 정책
CREATE POLICY "누구나 활성 카테고리 조회" ON categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "누구나 활성 상품 조회" ON products
    FOR SELECT USING (is_active = true);

CREATE POLICY "누구나 상품 옵션 조회" ON product_options
    FOR SELECT USING (true);

CREATE POLICY "누구나 활성 변형 조회" ON product_variants
    FOR SELECT USING (is_active = true);

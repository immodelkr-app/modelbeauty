-- ============================================================
-- 모델뷰티: 1:1 문의(Q&A) 게시판 테이블 생성
-- Migration: 00041_create_inquiries_table
-- ============================================================
-- 제품문의/체험단문의/앱사용문의/기타로 카테고리를 나눈 1:1 문의.
-- 기본적으로 비밀글(작성자 본인 + 관리자만 열람)이며, 관리자가 답변을
-- 등록하면 status가 answered로 바뀐다. wishlist_items/cart_items와
-- 동일하게 master_user_id는 im-core-auth 소속이라 FK를 걸 수 없어
-- 애플리케이션 레벨에서 검증하고, RLS는 서비스 롤(API 라우트)만 접근.

SET search_path TO model_beauty, public;

CREATE TABLE inquiries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id  UUID NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('product', 'trial', 'app', 'etc')),
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,

    title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    images          JSONB NOT NULL DEFAULT '[]',       -- [{ url: "..." }, ...]
    is_private      BOOLEAN NOT NULL DEFAULT true,

    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
    answer          TEXT,
    answered_at     TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_user ON inquiries(master_user_id);
CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_created ON inquiries(created_at DESC);

CREATE TRIGGER trigger_inquiries_updated_at
    BEFORE UPDATE ON inquiries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS 정책 ──────────────────────────────────────────────
-- 1:1 비밀글 문의는 서비스 롤(서버)만 접근 가능
-- (클라이언트 직접 접근 없음 — 모든 조작은 API 라우트를 통해 소유자/관리자 검증)

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

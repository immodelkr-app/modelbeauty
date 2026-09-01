-- ============================================================
-- 모델뷰티: 구매 후기/체험단 후기 완전 분리
-- Migration: 00029_split_trial_reviews
-- ============================================================
-- SNS 링크 첨부는 체험단 후기에서만 의미가 있으므로 구매 후기(product_reviews)
-- 에서는 제거하고, 체험단 후기는 별도 테이블(trial_reviews)로 분리한다.
-- 작성 자격도 서로 다르다: 구매 후기는 배송완료 주문(order_id), 체험단
-- 후기는 선정된 신청(trial_application_id) 기준.
--
-- 체험 후기는 상품 상세페이지 안에 묻히는 구매 후기와 달리 블로그 형식
-- (제목+본문+사진)으로 작성해 메인페이지에 노출, 구매 유도용 콘텐츠로 쓴다.
-- 그래서 별점(rating) 없이 title/body/images 중심 구조로 만든다.

SET search_path TO model_beauty, public;

ALTER TABLE product_reviews DROP COLUMN IF EXISTS external_link;

CREATE TABLE trial_reviews (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id           UUID NOT NULL REFERENCES trial_campaigns(id) ON DELETE CASCADE,
    trial_application_id  UUID NOT NULL REFERENCES trial_applications(id) ON DELETE CASCADE,
    master_user_id        UUID NOT NULL,

    title                 TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    body                  TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    images                JSONB NOT NULL DEFAULT '[]',
    external_link         TEXT,                      -- 블로그/유튜브/인스타 포스팅 링크 (선택)

    is_hidden             BOOLEAN NOT NULL DEFAULT false,
    hidden_reason         TEXT,

    points_granted        INTEGER NOT NULL DEFAULT 0,
    points_granted_at     TIMESTAMPTZ,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (trial_application_id)
);

CREATE INDEX idx_trial_reviews_campaign ON trial_reviews(campaign_id);
CREATE INDEX idx_trial_reviews_user ON trial_reviews(master_user_id);
CREATE INDEX idx_trial_reviews_created ON trial_reviews(created_at DESC);

CREATE TRIGGER trigger_trial_reviews_updated_at
    BEFORE UPDATE ON trial_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trial_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 공개 체험단 후기 조회" ON trial_reviews
    FOR SELECT USING (is_hidden = false);

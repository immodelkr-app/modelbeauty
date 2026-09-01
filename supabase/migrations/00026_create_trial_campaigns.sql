-- ============================================================
-- 모델뷰티: 체험단 모집 테이블 생성 (Phase 2 — 1단계: 캠페인 + 신청)
-- Migration: 00026_create_trial_campaigns
-- ============================================================
-- 운영 방식은 어드민 대행(업체 자체 포털 없음)으로 확정됨.
-- 이번 단계는 "캠페인 개설(어드민) + 공개 신청(회원)"까지만 다룬다.
-- 선정 처리·결제·알림 발송·리뷰 연동(product_reviews.trial_application_id)은
-- 다음 단계에서 이 테이블에 컬럼을 추가하는 방식으로 이어간다.

SET search_path TO model_beauty, public;

CREATE TABLE trial_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id       UUID REFERENCES vendors(id) ON DELETE SET NULL,

    title           TEXT NOT NULL,
    description     TEXT,                                 -- 지원 조건/안내 (자유 텍스트)

    campaign_type   TEXT NOT NULL DEFAULT 'free'
        CHECK (campaign_type IN ('free', 'paid')),
    price           INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),  -- paid일 때만 사용

    quota           INTEGER NOT NULL CHECK (quota > 0),
    recruit_start   TIMESTAMPTZ NOT NULL,
    recruit_end     TIMESTAMPTZ NOT NULL,

    status          TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'recruiting', 'selecting', 'closed')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (recruit_end > recruit_start)
);

CREATE INDEX idx_trial_campaigns_product ON trial_campaigns(product_id);
CREATE INDEX idx_trial_campaigns_status ON trial_campaigns(status);

CREATE TRIGGER trigger_trial_campaigns_updated_at
    BEFORE UPDATE ON trial_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE trial_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES trial_campaigns(id) ON DELETE CASCADE,
    master_user_id  UUID NOT NULL,

    channel_url     TEXT NOT NULL,                         -- 블로그/유튜브/인스타 등
    message         TEXT,                                  -- 지원 동기 (선택)

    status          TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN ('applied', 'selected', 'rejected')),

    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (campaign_id, master_user_id)                    -- 같은 캠페인 중복 신청 방지
);

CREATE INDEX idx_trial_applications_campaign ON trial_applications(campaign_id);
CREATE INDEX idx_trial_applications_user ON trial_applications(master_user_id);

-- ── RLS 정책 ──────────────────────────────────────────────
-- 공개 조회는 모집중 캠페인만, 신청서 조회/작성은 서비스 롤(API)에서만 처리

ALTER TABLE trial_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "누구나 모집중 체험단 조회" ON trial_campaigns
    FOR SELECT USING (status IN ('recruiting', 'selecting', 'closed'));

-- ============================================================
-- 모델뷰티: 관리자 설정 키밸류 테이블 + 생일 쿠폰 자동발급 로그
-- Migration: 00017_settings_and_birthday_coupons
-- ============================================================

SET search_path = model_beauty, public;

-- ── 관리자 설정 (범용 key-value) ────────────────────────────

CREATE TABLE system_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
-- 공개 정책 없음 — 관리자 API 라우트(service role)에서만 읽고 씀

-- ── 생일 쿠폰 발급 이력 (연도별 중복발급 방지 + 감사로그) ──────

CREATE TABLE birthday_coupon_issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id      UUID NOT NULL,
    year                INTEGER NOT NULL,
    coupon_template_id  TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('issued', 'failed')),
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(master_user_id, year)
);

CREATE INDEX idx_birthday_coupon_issues_year ON birthday_coupon_issues(year);

ALTER TABLE birthday_coupon_issues ENABLE ROW LEVEL SECURITY;
-- 공개 정책 없음 — cron/관리자 API 라우트(service role)에서만 접근

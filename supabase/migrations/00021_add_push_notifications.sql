-- 앱 푸시 알림 기능
-- push_tokens: 기기별 FCM 토큰 (로그인 전에도 등록 가능, 로그인 시 master_user_id 연결)
-- push_notifications: 관리자가 보낸 푸시 발송 이력
CREATE TABLE push_tokens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_user_id UUID NULL,
    fcm_token      TEXT NOT NULL UNIQUE,
    platform       TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_tokens_master_user ON push_tokens(master_user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active);

CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE push_notifications (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                 TEXT NOT NULL,
    body                  TEXT NOT NULL,
    link_url              TEXT NULL,
    target_type           TEXT NOT NULL CHECK (target_type IN ('all', 'user')),
    target_master_user_id UUID NULL,
    target_count          INTEGER NOT NULL DEFAULT 0,
    success_count         INTEGER NOT NULL DEFAULT 0,
    failure_count         INTEGER NOT NULL DEFAULT 0,
    sent_by               TEXT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_notifications_created ON push_notifications(created_at DESC);

-- 순수 관리 데이터라 공개 SELECT 정책 없음 — service-role 어드민 API로만 접근
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

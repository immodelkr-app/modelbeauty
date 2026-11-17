-- ============================================================
-- 모델뷰티: IMFF 티켓 로그인 1회용 처리 테이블
-- Migration: 00043_create_used_imff_tickets
-- ============================================================
-- /api/auth/imff-login 이 받은 티켓의 jti를 한 번만 사용하게 기록한다.
-- 같은 jti를 두 번 넣으면 PRIMARY KEY 충돌로 거절된다(URL 유출 후 재사용 방지).
-- 서비스 롤(API 라우트)만 접근, 클라이언트 직접 접근 없음.

SET search_path TO model_beauty, public;

CREATE TABLE used_imff_tickets (
    jti      TEXT PRIMARY KEY,
    used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_used_imff_tickets_used_at ON used_imff_tickets(used_at);

ALTER TABLE used_imff_tickets ENABLE ROW LEVEL SECURITY;

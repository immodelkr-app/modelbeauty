-- ============================================================
-- 모델뷰티: 라이브 크루 및 정산 관리 테이블 생성
-- Migration: 00007_crew_settlement
-- ============================================================

-- 검색 경로 설정 (model_beauty 스키마)
SET search_path = model_beauty, public;

-- ── 라이브 크루 정보 ──────────────────────────────────────────
CREATE TABLE live_crews (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    nickname                TEXT NOT NULL,
    phone                   TEXT NOT NULL,
    resident_registration_number TEXT NOT NULL, -- AES-256-GCM 암호화 데이터 저장
    bank_name               TEXT NOT NULL,
    account_number          TEXT NOT NULL, -- AES-256-GCM 암호화 데이터 저장
    default_commission_rate NUMERIC DEFAULT 0 CHECK (default_commission_rate >= 0 AND default_commission_rate <= 100),
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_live_crews_name ON live_crews(name);
CREATE INDEX idx_live_crews_nickname ON live_crews(nickname);

-- ── 라이브 방송-크루 매핑 (N:M 공동 진행 지원) ─────────────────
CREATE TABLE live_stream_crews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id       UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    crew_id         UUID NOT NULL REFERENCES live_crews(id) ON DELETE CASCADE,
    commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(stream_id, crew_id)
);

CREATE INDEX idx_live_stream_crews_stream ON live_stream_crews(stream_id);
CREATE INDEX idx_live_stream_crews_crew ON live_stream_crews(crew_id);

-- ── 주문 테이블에 라이브 방송 ID 외래키 추가 ───────────────────
ALTER TABLE orders ADD COLUMN live_stream_id UUID REFERENCES live_streams(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_live_stream ON orders(live_stream_id);

-- ── 크루 월별 정산 내역 ─────────────────────────────────────────
CREATE TABLE crew_settlement_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_month          TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'), -- 형식: YYYY-MM
    crew_id             UUID NOT NULL REFERENCES live_crews(id) ON DELETE CASCADE,
    total_sales         INTEGER NOT NULL DEFAULT 0, -- 총 판매액 (구매확정 기준)
    total_settlement    INTEGER NOT NULL DEFAULT 0, -- 정산 금액 (세전)
    tax_amount          INTEGER NOT NULL DEFAULT 0, -- 원천세 3.3% (소득세 3% + 지방소득세 0.3%)
    net_payout          INTEGER NOT NULL DEFAULT 0, -- 실지급액 (세후)
    payout_status       TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'withheld')),
    note                TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(year_month, crew_id)
);

CREATE INDEX idx_crew_settlement_history_ym ON crew_settlement_history(year_month);
CREATE INDEX idx_crew_settlement_history_crew ON crew_settlement_history(crew_id);

-- ── RLS 활성화 (민감 정산 데이터는 관리자/서버만 접근 가능하도록 공개 정책 설정 안 함) ──
ALTER TABLE live_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_settlement_history ENABLE ROW LEVEL SECURITY;

-- ── 자동 updated_at 트리거 등록 ─────────────────────────────────
CREATE TRIGGER trigger_live_crews_updated_at
    BEFORE UPDATE ON live_crews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_crew_settlement_history_updated_at
    BEFORE UPDATE ON crew_settlement_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

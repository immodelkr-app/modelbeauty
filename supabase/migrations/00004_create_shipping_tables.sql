-- ============================================================
-- 모델뷰티: 배송 정보 테이블 생성
-- Migration: 00004_create_shipping_tables
-- ============================================================

CREATE TABLE shipping_info (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier_code        TEXT NOT NULL,              -- 스마트택배 택배사 코드
    carrier_name        TEXT NOT NULL,              -- 택배사 이름 (예: CJ대한통운)
    tracking_number     TEXT NOT NULL,              -- 송장번호
    tracking_url        TEXT,                       -- 택배사 직접 추적 URL
    shipped_at          TIMESTAMPTZ DEFAULT now(),  -- 출고(발송) 일시
    delivered_at        TIMESTAMPTZ,                -- 배달 완료 일시
    last_tracked_at     TIMESTAMPTZ,                -- 마지막 추적 일시
    tracking_status     JSONB,                      -- 최근 배송 상태 캐시
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id)                                -- 주문당 하나의 배송 정보
);

CREATE INDEX idx_shipping_info_order ON shipping_info(order_id);
CREATE INDEX idx_shipping_info_tracking ON shipping_info(carrier_code, tracking_number);

ALTER TABLE shipping_info ENABLE ROW LEVEL SECURITY;
-- 배송 데이터는 서비스 롤(서버)만 접근 가능

-- ============================================================
-- 모델뷰티: 환불 요청 테이블 생성
-- Migration: 00005_create_refund_tables
-- ============================================================

CREATE TABLE refund_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id),
    master_user_id      UUID NOT NULL,
    reason              TEXT NOT NULL,              -- 환불 사유 (선택지)
    detail_reason       TEXT,                       -- 상세 사유
    refund_amount       INTEGER NOT NULL,           -- 환불 금액 (카드/계좌)
    point_refund_amount INTEGER DEFAULT 0,          -- 포인트 환불분
    coupon_refund       BOOLEAN DEFAULT false,      -- 쿠폰 복원 여부
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_note          TEXT,                       -- 관리자 처리 메모
    processed_at        TIMESTAMPTZ,               -- 처리 일시
    processed_by        TEXT,                       -- 처리 담당자
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refund_requests_order ON refund_requests(order_id);
CREATE INDEX idx_refund_requests_user ON refund_requests(master_user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);

ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
-- 환불 데이터는 서비스 롤(서버)만 접근 가능

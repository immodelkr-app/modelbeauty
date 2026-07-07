-- ============================================================
-- Migration: 00010_create_vendors.sql
-- 업체(Vendor) 관리 시스템 신설
-- ============================================================

-- 1. 업체 테이블 생성
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_number TEXT,
  representative_name TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  default_cost_type TEXT NOT NULL DEFAULT 'rate'
    CHECK (default_cost_type IN ('rate', 'fixed')),
  default_cost_rate NUMERIC NOT NULL DEFAULT 0
    CHECK (default_cost_rate >= 0 AND default_cost_rate <= 100),
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. products 테이블에 업체 연결 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_cost_type TEXT NOT NULL DEFAULT 'rate'
    CHECK (vendor_cost_type IN ('rate', 'fixed')),
  ADD COLUMN IF NOT EXISTS vendor_cost_rate NUMERIC NOT NULL DEFAULT 0
    CHECK (vendor_cost_rate >= 0 AND vendor_cost_rate <= 100),
  ADD COLUMN IF NOT EXISTS vendor_supply_price INTEGER NOT NULL DEFAULT 0
    CHECK (vendor_supply_price >= 0);

-- 3. 업체 정산 이력 테이블 생성
CREATE TABLE IF NOT EXISTS vendor_settlement_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_payout INTEGER NOT NULL DEFAULT 0,
  payout_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'paid', 'withheld')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year_month, vendor_id)
);

ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_settlement_history DISABLE ROW LEVEL SECURITY;

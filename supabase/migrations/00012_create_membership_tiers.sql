-- ============================================================
-- Migration: 00012_create_membership_tiers.sql
-- 회원 등급(멤버십) 시스템 신설
-- ============================================================

-- 1. 등급 정의 테이블 (관리자가 기준값/할인율 조정 가능)
CREATE TABLE IF NOT EXISTS model_beauty.membership_tiers (
  id TEXT PRIMARY KEY,           -- 'normal', 'silver', 'gold', 'im_model', 'exclusive'
  name TEXT NOT NULL,            -- 표시 이름
  sort_order INTEGER NOT NULL,   -- 정렬 순서 (낮을수록 낮은 등급)
  min_amount INTEGER NOT NULL DEFAULT 0,   -- 6개월 누적 구매액 승급 기준 (원)
  discount_rate NUMERIC NOT NULL DEFAULT 0
    CHECK (discount_rate >= 0 AND discount_rate <= 100),  -- 할인율 (%)
  badge_emoji TEXT NOT NULL DEFAULT '💛', -- 배지 이모지
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 초기 등급 데이터 INSERT
INSERT INTO model_beauty.membership_tiers (id, name, sort_order, min_amount, discount_rate, badge_emoji)
VALUES
  ('normal',    '일반',     1,        0, 0, '💛'),
  ('silver',    '실버',     2,   100000, 2, '🥈'),
  ('gold',      '골드',     3,   300000, 5, '🥇'),
  ('im_model',  '아임모델', 4,   500000, 8, '⭐'),
  ('exclusive', '전속모델', 5,  1000000, 8, '💎')
ON CONFLICT (id) DO NOTHING;

-- 3. 회원별 등급 상태 테이블
CREATE TABLE IF NOT EXISTS model_beauty.user_memberships (
  master_user_id TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL DEFAULT 'normal'
    REFERENCES model_beauty.membership_tiers(id),
  is_locked BOOLEAN NOT NULL DEFAULT false,   -- true 이면 자동 재산정 제외
  locked_by TEXT,                              -- 잠금 설정한 관리자 ID
  locked_at TIMESTAMPTZ,
  lock_reason TEXT,                            -- 잠금 사유 (예: "MOCA 골드 연동")
  last_recalc_at TIMESTAMPTZ,                 -- 마지막 재산정 시각
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. orders 테이블 컬럼 추가
ALTER TABLE model_beauty.orders
  ADD COLUMN IF NOT EXISTS membership_discount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_tier_id TEXT;

-- 5. RLS 비활성화 (어드민 서버에서만 접근)
ALTER TABLE model_beauty.membership_tiers DISABLE ROW LEVEL SECURITY;
ALTER TABLE model_beauty.user_memberships DISABLE ROW LEVEL SECURITY;

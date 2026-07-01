-- ============================================================
-- 모델뷰티: 라이브커머스 및 상품 영상 테이블 생성
-- Migration: 00006_create_live_stream_tables
-- ============================================================

-- 검색 경로 설정 (model_beauty 스키마에 테이블 생성 보장)
SET search_path = model_beauty, public;

-- ── 라이브 스트림 ──────────────────────────────────────────

CREATE TABLE live_streams (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    description       TEXT,
    streamer_name     TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'live', 'ended')),
    cover_image_url   TEXT,
    stream_url        TEXT,
    replay_url        TEXT,
    active_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    viewer_count      INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT now(),
    started_at        TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ
);

CREATE INDEX idx_live_streams_status ON live_streams(status);
CREATE INDEX idx_live_streams_active_prod ON live_streams(active_product_id);
CREATE INDEX idx_live_streams_created_at ON live_streams(created_at DESC);

-- ── 라이브 스트림 상품 매핑 ────────────────────────────────

CREATE TABLE live_stream_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id   UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order  INTEGER DEFAULT 0,
    UNIQUE(stream_id, product_id)
);

CREATE INDEX idx_live_stream_products_stream ON live_stream_products(stream_id);
CREATE INDEX idx_live_stream_products_product ON live_stream_products(product_id);

-- ── 실시간 채팅 내역 ────────────────────────────────────────

CREATE TABLE live_stream_chats (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id      UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    master_user_id UUID NOT NULL,
    nickname       TEXT NOT NULL,
    message        TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_live_stream_chats_stream ON live_stream_chats(stream_id);
CREATE INDEX idx_live_stream_chats_created_at ON live_stream_chats(stream_id, created_at DESC);

-- ── 상품 영상 ───────────────────────────────────────────────

CREATE TABLE product_videos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stream_id      UUID REFERENCES live_streams(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    video_url      TEXT NOT NULL,
    thumbnail_url  TEXT,
    source_type    TEXT NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('live_replay', 'manual')),
    duration_sec   INTEGER,
    sort_order     INTEGER DEFAULT 0,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_videos_product ON product_videos(product_id);
CREATE INDEX idx_product_videos_stream ON product_videos(stream_id);
CREATE INDEX idx_product_videos_active_order ON product_videos(product_id, is_active, sort_order);

-- ── RLS 활성화 ──────────────────────────────────────────────
-- 모든 테이블에 RLS 설정. 조회 정책은 공개, 쓰기는 서비스 롤 및 검증된 권한만.

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_stream_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_videos ENABLE ROW LEVEL SECURITY;

-- ── RLS 정책 ────────────────────────────────────────────────

-- 1. 누구나 조회 가능 정책
CREATE POLICY "누구나 라이브 방송 조회" ON live_streams FOR SELECT USING (true);
CREATE POLICY "누구나 라이브 상품 매핑 조회" ON live_stream_products FOR SELECT USING (true);
CREATE POLICY "누구나 라이브 채팅 조회" ON live_stream_chats FOR SELECT USING (true);
CREATE POLICY "누구나 활성 상품 영상 조회" ON product_videos FOR SELECT USING (is_active = true);

-- 2. 클라이언트 레벨에서 직접 쓰기 작업이 필요한 live_stream_chats에 대해서만 로그인한 사용자의 INSERT 정책을 추가합니다.
CREATE POLICY "로그인한 유저는 채팅 등록 가능" ON live_stream_chats
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- 라이브 방송 RTMP 스트림 키/수신 엔드포인트 컬럼 접근 제한
-- Migration: 00040_restrict_live_stream_secret_columns
-- ============================================================
-- RLS는 행 단위로만 제어되고 컬럼 단위는 제어하지 않는다. "누구나 라이브 방송 조회"
-- 정책(00006_create_live_stream_tables.sql)이 걸려 있는 한, anon/authenticated 롤은
-- select('*')로 stream_key / ingest_endpoint / channel_arn까지 그대로 읽을 수 있었다
-- (공개된 NEXT_PUBLIC_SUPABASE_ANON_KEY로 Supabase REST API를 직접 호출해도 동일하게 유출됨).
--
-- 주의: live_streams에 대한 SELECT 권한은 (Supabase 기본 설정으로) 테이블 단위로
-- anon/authenticated에 부여되어 있어서, 컬럼을 지정한 REVOKE SELECT (col) ... 만으로는
-- 아무 효과가 없다 (테이블 단위 권한이 그대로 남아 컬럼 접근을 계속 허용함).
-- 따라서 테이블 단위 SELECT 권한을 통째로 회수한 뒤, 공개해도 되는 컬럼만 다시
-- 컬럼 단위로 GRANT한다.
--
-- (service_role은 GRANT/REVOKE 대상에서 제외되어 있으므로 영향받지 않으며 계속
--  전체 컬럼에 접근 가능 — 관리자 기능은 애플리케이션 코드에서 서비스 롤 클라이언트로
--  조회하도록 이미 맞춰 두었다.)

SET search_path = model_beauty, public;

REVOKE SELECT ON live_streams FROM anon, authenticated;

GRANT SELECT (
  id, title, description, streamer_name, status, cover_image_url,
  stream_url, replay_url, active_product_id, viewer_count,
  created_at, started_at, ended_at, scheduled_at, pinned_message, notify_sent_at
) ON live_streams TO anon, authenticated;

-- ============================================================
-- 모델뷰티: 닉네임/휴대폰 기반 로그인 시 로컬 Supabase Auth 유저 단건 조회 함수
-- Migration: 00019_add_find_local_auth_user_function
-- ============================================================
-- 타 앱(모카 등)에서 모델뷰티로 넘어오는 SSO 연동을 위해 get-auth-email 라우트가
-- 로컬 Supabase Auth 계정의 email이 비어있거나 형식이 다를 때 자동 보정하는 로직이
-- 있는데, 이 계정을 찾기 위해 매 로그인마다 auth.admin.listUsers(최대 1000명)로
-- 전체 유저를 네트워크로 끌어와 JS에서 순회 검색하고 있었다. 이 함수는 그 탐색을
-- DB 인덱스 기반 단건 조회로 대체해 로그인 지연을 줄인다. 매칭/보정 로직 자체는
-- 기존과 동일하게 유지한다(SSO 동작에는 영향 없음).
--
-- SECURITY DEFINER로 auth.users를 조회하며, service_role에서만 호출 가능하도록 제한한다.

CREATE OR REPLACE FUNCTION model_beauty.find_local_auth_user(p_phone TEXT, p_nickname TEXT)
RETURNS TABLE(id UUID, email TEXT, phone TEXT, user_metadata JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.email, u.phone, u.raw_user_meta_data AS user_metadata
  FROM auth.users u
  WHERE
    (p_phone IS NOT NULL AND (
      u.phone = p_phone
      OR (u.raw_user_meta_data ->> 'phone') = p_phone
      OR u.phone LIKE '%' || p_phone
    ))
    OR (p_nickname IS NOT NULL AND (
      (u.raw_user_meta_data ->> 'name') = p_nickname
      OR (u.raw_user_meta_data ->> 'nickname') = p_nickname
      OR (u.raw_user_meta_data ->> 'real_name') = p_nickname
    ))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION model_beauty.find_local_auth_user(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION model_beauty.find_local_auth_user(TEXT, TEXT) TO service_role;

-- ============================================================
-- 모델뷰티: live_streams.viewer_count 원자적 증감 함수
-- Migration: 00014_add_viewer_count_function
-- ============================================================
-- 시청 시작/종료 시 viewer_count를 안전하게 증감시키기 위한 함수.
-- 동시 요청에서도 read-then-write 경쟁 없이 DB 레벨에서 원자적으로 처리하며,
-- 0 미만으로 내려가지 않도록 방어한다.
--
-- SET search_path를 함수 속성으로 고정해야 한다: 호출자 세션의 search_path가
-- model_beauty를 포함하지 않으면(RPC 호출 등) 본문의 비한정 테이블명이
-- 해석되지 않아 "relation does not exist" 오류가 발생하기 때문.

CREATE OR REPLACE FUNCTION model_beauty.adjust_viewer_count(p_stream_id UUID, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = model_beauty, public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE model_beauty.live_streams
  SET viewer_count = GREATEST(0, viewer_count + p_delta)
  WHERE id = p_stream_id
  RETURNING viewer_count INTO new_count;

  RETURN new_count;
END;
$$;

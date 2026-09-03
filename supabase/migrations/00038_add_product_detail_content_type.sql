-- ============================================================
-- 상품 상세페이지 작성 방식(이미지 나열형 / 블로그 에디터형) 구분 컬럼 추가
-- content 컬럼은 그대로 재사용: images 모드는 <img> 나열 HTML, editor 모드는
-- Toast UI Editor에서 생성 후 서버에서 sanitize한 HTML을 저장한다.
-- Migration: 00038_add_product_detail_content_type
-- ============================================================

SET search_path = model_beauty, public;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS detail_content_type TEXT NOT NULL DEFAULT 'images'
        CHECK (detail_content_type IN ('images', 'editor'));

-- ============================================================
-- 모델뷰티: 체험 후기에 총점 별점(0.5점 단위) 추가
-- Migration: 00034_add_trial_review_rating
-- ============================================================
-- 기존에는 블로그 형식(제목+본문+사진)만 받고 별점은 의도적으로 뺐었는데,
-- 리뷰 신뢰도를 위해 "총점" 별점(1.0~5.0, 0.5점 단위) 문항을 필수로 추가한다.
-- 기존 행은 기본값 5.0으로 채우고, 이후 입력은 API에서 항상 명시적으로
-- 받도록 컬럼 기본값은 제거한다.

SET search_path TO model_beauty, public;

ALTER TABLE trial_reviews
    ADD COLUMN rating NUMERIC(2,1) NOT NULL DEFAULT 5.0
        CHECK (rating IN (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5));

ALTER TABLE trial_reviews
    ALTER COLUMN rating DROP DEFAULT;

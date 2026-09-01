-- ============================================================
-- 모델뷰티: 체험단 캠페인 상세 내용(content) 컬럼 추가
-- Migration: 00027_add_trial_campaign_content
-- ============================================================
-- description은 목록 카드에 쓰는 짧은 소개, content는 상세페이지 본문
-- (지원 조건/진행 방식 등을 글+사진으로 설명) — 상품의 description/content
-- 분리 패턴과 동일하게 맞춘다.

SET search_path TO model_beauty, public;

ALTER TABLE trial_campaigns
  ADD COLUMN IF NOT EXISTS content TEXT;

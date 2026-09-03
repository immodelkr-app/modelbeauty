-- ============================================================
-- 모델뷰티: 상품 삭제 시 연결된 체험단이 함께 삭제되던 것을 방지
-- Migration: 00037_trial_campaign_product_delete_set_null
-- ============================================================
-- 00033에서 product_id를 NULL 허용으로 바꿔 "상품 연결"을 선택사항으로
-- 만들었지만, ON DELETE CASCADE는 그대로 남아있어 실제로는 상품을 삭제하면
-- 연결된 체험단(신청자·후기 포함)까지 통째로 사라지는 문제가 있었다.
-- 상품 연결은 선택사항이므로, 상품이 삭제되면 체험단은 지우지 않고
-- 단순히 연결만 해제(product_id = NULL)하도록 변경한다.

SET search_path TO model_beauty, public;

ALTER TABLE trial_campaigns
    DROP CONSTRAINT trial_campaigns_product_id_fkey;

ALTER TABLE trial_campaigns
    ADD CONSTRAINT trial_campaigns_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

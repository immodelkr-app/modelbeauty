// ============================================================
// privacy.ts — 회원 탈퇴 시 개인정보 익명화 공통 로직
// ============================================================
// 본인 탈퇴(/api/auth/withdraw)와 어드민 강제 탈퇴(/api/admin/users/[id])
// 양쪽에서 동일하게 사용합니다. 주문 자체(금액/상품/상태)는 전자상거래법상
// 보관 의무가 있어 삭제하지 않고, 배송지 등 식별 가능한 개인정보만 비식별화합니다.

import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function anonymizeOrderPII(masterUserId: string): Promise<void> {
  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("orders")
    .update({
      recipient_name: "탈퇴한 회원",
      recipient_phone: "00000000000",
      address_zipcode: "00000",
      address_main: "탈퇴한 회원",
      address_detail: null,
      delivery_memo: null,
    })
    .eq("master_user_id", masterUserId);

  if (error) {
    console.error("[anonymizeOrderPII] 주문 개인정보 익명화 실패:", error);
  }
}

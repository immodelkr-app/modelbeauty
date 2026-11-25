// ============================================================
// 구매 확정 시 포인트 적립 (결제액의 1%) — 관리자 단건/일괄 변경, 자동 확정 크론 공통
// ============================================================

import { rewardPoints } from "@/lib/core-auth";

export async function rewardConfirmPoints(order: {
  master_user_id: string;
  total_amount: number;
  order_number: string;
}): Promise<void> {
  const rewardAmount = Math.floor((order.total_amount ?? 0) * 0.01);
  if (rewardAmount <= 0) return;
  await rewardPoints({
    masterUserId: order.master_user_id,
    amount: rewardAmount,
    description: `구매 확정 포인트 적립 (${order.order_number})`,
  });
}

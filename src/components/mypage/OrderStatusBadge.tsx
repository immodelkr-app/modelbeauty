// ============================================================
// OrderStatusBadge — 주문 상태 색상 뱃지
// ============================================================

import type { OrderStatus } from "@/types";

const STATUS_MAP: Record<OrderStatus, { label: string; icon: string }> = {
  pending:          { label: "결제 대기", icon: "⏳" },
  paid:             { label: "결제 완료", icon: "✅" },
  preparing:        { label: "상품 준비중", icon: "📦" },
  shipping:         { label: "배송중", icon: "🚚" },
  delivered:        { label: "배송 완료", icon: "📬" },
  confirmed:        { label: "구매 확정", icon: "✔️" },
  cancelled:        { label: "주문 취소", icon: "✖️" },
  refund_requested: { label: "환불 요청", icon: "↩️" },
  refunded:         { label: "환불 완료", icon: "💰" },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  showIcon?: boolean;
}

export default function OrderStatusBadge({
  status,
  showIcon = true,
}: OrderStatusBadgeProps) {
  const { label, icon } = STATUS_MAP[status] ?? { label: status, icon: "•" };

  return (
    <span className={`order-status-badge order-status-${status}`}>
      {showIcon && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}

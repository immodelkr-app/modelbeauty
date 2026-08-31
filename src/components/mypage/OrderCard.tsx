// ============================================================
// OrderCard — 주문 목록 카드
// ============================================================

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import OrderStatusBadge from "@/components/mypage/OrderStatusBadge";
import type { OrderStatus } from "@/types";

interface OrderCardData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  firstItem: {
    productName: string;
    variantInfo: Record<string, string> | null;
    quantity: number;
    imageUrl: string | null;
    slug: string | null;
  } | null;
  shippingInfo?: {
    carrierName: string;
    trackingNumber: string;
    shippedAt: string;
    deliveredAt: string | null;
  } | null;
}

interface OrderCardProps {
  order: OrderCardData;
  onCancelled?: (orderId: string) => void;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function OrderCard({ order, onCancelled }: OrderCardProps) {
  const { firstItem, shippingInfo } = order;
  const moreCount = order.itemCount - 1;
  const optionText = firstItem?.variantInfo
    ? Object.values(firstItem.variantInfo).join(" / ")
    : null;
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (isCancelling) return;
    if (!window.confirm("주문을 취소하시겠습니까?")) return;

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/mypage/orders/${order.id}/cancel`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        alert(result.error ?? "주문 취소에 실패했습니다.");
        return;
      }
      onCancelled?.(order.id);
    } catch {
      alert("주문 취소 중 오류가 발생했습니다.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <article className="order-card" aria-label={`주문 ${order.orderNumber}`}>
      {/* 헤더: 주문번호 + 상태 + 날짜 */}
      <div className="order-card-header">
        <div>
          <p className="order-card-number">{order.orderNumber}</p>
          <p className="order-card-date">{formatDate(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* 바디: 대표 상품 */}
      {firstItem && (
        <div className="order-card-body">
          <div className="order-card-thumb">
            {firstItem.imageUrl ? (
              <Image
                src={firstItem.imageUrl}
                alt={firstItem.productName}
                fill
                sizes="72px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <span aria-hidden="true">💄</span>
            )}
          </div>

          <div className="order-card-info">
            <p className="order-card-product-name">
              {firstItem.productName}
              {moreCount > 0 && (
                <span style={{ color: "var(--mb-gray-400)", fontWeight: 400 }}>
                  {" "}외 {moreCount}건
                </span>
              )}
            </p>
            <p className="order-card-meta">
              {[optionText, `${firstItem.quantity}개`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {shippingInfo && (
              <p className="order-card-meta">
                🚚 {shippingInfo.carrierName} {shippingInfo.trackingNumber}
              </p>
            )}
            <p className="order-card-amount">{formatPrice(order.totalAmount)}</p>
          </div>
        </div>
      )}

      {/* 푸터: 상세보기 + 액션 */}
      <div className="order-card-footer">
        <Link
          href={`/mypage/orders/${order.id}`}
          className="order-card-detail-link"
        >
          주문 상세 보기 →
        </Link>

        <div className="order-card-actions">
          {/* 배송 조회 (배송중/완료 시) */}
          {(order.status === "shipping" || order.status === "delivered") &&
            shippingInfo && (
              <Link
                href={`/mypage/orders/${order.id}`}
                className="order-action-btn order-action-btn-outline"
              >
                🚚 배송 조회
              </Link>
            )}
          {/* 구매 확정 (배송 완료 시) */}
          {order.status === "delivered" && (
            <button className="order-action-btn order-action-btn-primary">
              구매 확정
            </button>
          )}
          {/* 취소 (결제 대기/완료 시) */}
          {(order.status === "pending" || order.status === "paid") && (
            <button
              className="order-action-btn order-action-btn-outline"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? "취소 중..." : "주문 취소"}
            </button>
          )}
          {/* 다시 주문 */}
          {(order.status === "confirmed" || order.status === "cancelled") && (
            <button className="order-action-btn order-action-btn-outline">
              다시 주문
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

"use client";
// /mypage/orders/[id] — 마이페이지 주문 상세 + 배송 추적

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import TrackingTimeline from "@/components/tracking/TrackingTimeline";
import OrderStatusBadge from "@/components/mypage/OrderStatusBadge";
import type { OrderStatus } from "@/types";

function formatPrice(n: number) { return n.toLocaleString("ko-KR") + "원"; }

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  variant_info: Record<string, string> | null;
  products: { images?: { url: string }[] } | null;
}

interface ShippingInfo {
  carrier_code: string;
  carrier_name: string;
  tracking_number: string;
  shipped_at: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  shipping_fee: number;
  point_discount: number;
  total_amount: number;
  recipient_name: string;
  recipient_phone: string;
  address_zipcode: string;
  address_main: string;
  address_detail: string | null;
  delivery_memo: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: OrderItem[];
  shipping_info: ShippingInfo | null;
}

export default function MyOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/mypage/orders/${id}`)
        .then((r) => r.json())
        .then(({ success, data }) => {
          if (!success || !data) { setNotFound(true); return; }
          setOrder(data);
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return (
      <div style={{ padding: "4rem 1rem", textAlign: "center", color: "var(--mb-gray-400)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        주문 정보를 불러오는 중...
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
        <p style={{ fontWeight: 700, color: "var(--mb-gray-700)" }}>주문을 찾을 수 없습니다</p>
        <Link href="/mypage/orders" className="btn-primary" style={{ marginTop: "1.5rem", display: "inline-flex" }}>
          주문 목록으로
        </Link>
      </div>
    );
  }

  const shipping = order.shipping_info;
  const isShipping = ["shipping", "delivered", "confirmed"].includes(order.status);

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 0 3rem" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mb-gray-500)", fontSize: "0.875rem", padding: 0, display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}
          >
            ← 주문 목록
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: 0 }}>
            주문 상세
          </h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--mb-gray-400)", marginTop: "0.25rem", fontFamily: "monospace" }}>
            {order.order_number}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* 배송 추적 — 배송중 이상인 경우 */}
        {isShipping && shipping && (
          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--mb-gray-900)", marginBottom: "0.875rem" }}>
              🚚 배송 추적
            </h2>
            <TrackingTimeline
              carrierCode={shipping.carrier_code}
              carrierName={shipping.carrier_name}
              trackingNumber={shipping.tracking_number}
              orderId={order.id}
            />
          </section>
        )}

        {/* 배송 중이지만 배송 정보 없음 */}
        {isShipping && !shipping && (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "16px", padding: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <span>⏳</span>
            <div>
              <p style={{ fontWeight: 700, color: "#92400e", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>배송 정보 준비 중</p>
              <p style={{ fontSize: "0.8125rem", color: "#b45309", margin: 0 }}>
                송장이 등록되면 여기서 배송 현황을 실시간으로 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {/* 주문 상품 */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--mb-gray-900)", marginBottom: "0.875rem" }}>
            주문 상품
          </h2>
          <div style={{ background: "#fff", border: "1.5px solid var(--mb-gray-100)", borderRadius: "16px", overflow: "hidden" }}>
            {order.order_items.map((item, idx) => {
              const thumb = item.products?.images?.[0]?.url ?? null;
              return (
                <div key={item.id} style={{ padding: "1rem 1.25rem", borderBottom: idx < order.order_items.length - 1 ? "1px solid var(--mb-gray-50)" : "none", display: "flex", gap: "1rem", alignItems: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "12px", background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                    {thumb ? <Image src={thumb} alt={item.product_name} width={56} height={56} style={{ objectFit: "cover" }} /> : "💄"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--mb-gray-900)", fontSize: "0.9rem" }}>{item.product_name}</div>
                    {item.variant_info && (
                      <div style={{ fontSize: "0.75rem", color: "var(--mb-gray-400)", marginTop: "0.125rem" }}>
                        {Object.values(item.variant_info).join(" / ")}
                      </div>
                    )}
                    <div style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", marginTop: "0.25rem" }}>
                      {formatPrice(item.unit_price)} × {item.quantity}개
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: "var(--mb-gray-900)", flexShrink: 0 }}>
                    {formatPrice(item.subtotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 배송 주소 */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--mb-gray-900)", marginBottom: "0.875rem" }}>배송지</h2>
          <div style={{ background: "#fff", border: "1.5px solid var(--mb-gray-100)", borderRadius: "16px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[
              ["수령인", order.recipient_name],
              ["연락처", order.recipient_phone],
              ["주소", `(${order.address_zipcode}) ${order.address_main} ${order.address_detail ?? ""}`],
              ["배송 메모", order.delivery_memo ?? "없음"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", gap: "1rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-400)", width: "60px", flexShrink: 0, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: "0.875rem", color: "var(--mb-gray-800)" }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 결제 정보 */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--mb-gray-900)", marginBottom: "0.875rem" }}>결제 정보</h2>
          <div style={{ background: "#fff", border: "1.5px solid var(--mb-gray-100)", borderRadius: "16px", padding: "1.25rem" }}>
            {[
              { label: "상품 합계", value: formatPrice(order.subtotal) },
              { label: "배송비", value: formatPrice(order.shipping_fee) },
              { label: "포인트 할인", value: `−${formatPrice(order.point_discount)}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--mb-gray-500)", marginBottom: "0.5rem" }}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
            <div style={{ height: "1px", background: "var(--mb-gray-100)", margin: "0.75rem 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", color: "var(--mb-gray-900)" }}>
              <span>최종 결제</span>
              <span style={{ background: "var(--mb-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {formatPrice(order.total_amount)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

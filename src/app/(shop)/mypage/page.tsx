"use client";

// ============================================================
// /mypage — 마이페이지 홈 (프로필 요약 + 최근 주문)
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWishlistStore } from "@/store/wishlist.store";
import OrderCard from "@/components/mypage/OrderCard";
import type { OrderStatus } from "@/types";

interface RecentOrder {
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

export default function MypagePage() {
  const { masterUser } = useAuthStore();
  const { items: wishlistItems } = useWishlistStore();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  useEffect(() => {
    fetch("/api/mypage/orders?page=1")
      .then((r) => r.json())
      .then(({ data }) => {
        setRecentOrders((data?.orders ?? []).slice(0, 3));
        setOrderCount(data?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setIsLoadingOrders(false));
  }, []);

  const points = masterUser?.integratedPoints ?? 0;

  const SUMMARY = [
    {
      href: "/mypage/orders",
      icon: "📦",
      value: orderCount,
      label: "주문 내역",
      suffix: "건",
    },
    {
      href: "/mypage/points",
      icon: "✨",
      value: points.toLocaleString("ko-KR"),
      label: "보유 포인트",
      suffix: "P",
    },
    {
      href: "/mypage/wishlist",
      icon: "❤️",
      value: wishlistItems.length,
      label: "위시리스트",
      suffix: "개",
    },
    {
      href: "/cart",
      icon: "🛒",
      value: "장바구니",
      label: "쇼핑 계속하기",
      suffix: "",
    },
  ];

  return (
    <>
      <h1 className="mypage-section-title">
        안녕하세요, {masterUser?.name ?? "회원"}님 👋
      </h1>

      {/* 요약 카드 그리드 */}
      <div className="mypage-summary-grid">
        {SUMMARY.map((item) => (
          <Link key={item.href} href={item.href} className="mypage-summary-card">
            <div className="mypage-summary-icon" aria-hidden="true">
              {item.icon}
            </div>
            <div className="mypage-summary-value">
              {item.value}
              {item.suffix && (
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--mb-gray-400)",
                    marginLeft: "2px",
                  }}
                >
                  {item.suffix}
                </span>
              )}
            </div>
            <div className="mypage-summary-label">{item.label}</div>
          </Link>
        ))}
      </div>

      {/* 최근 주문 */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.0625rem",
              fontWeight: 800,
              color: "var(--mb-gray-900)",
              margin: 0,
            }}
          >
            최근 주문
          </h2>
          <Link
            href="/mypage/orders"
            style={{
              fontSize: "0.875rem",
              color: "var(--mb-pink-500)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            전체 보기 →
          </Link>
        </div>

        {isLoadingOrders ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: "160px", borderRadius: "20px" }}
              />
            ))}
          </div>
        ) : recentOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="order-empty">
            <div className="order-empty-icon" aria-hidden="true">📦</div>
            <h3>아직 주문 내역이 없습니다</h3>
            <p>마음에 드는 상품을 구매해보세요!</p>
            <Link href="/products" className="hero-cta-primary">
              쇼핑하러 가기
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

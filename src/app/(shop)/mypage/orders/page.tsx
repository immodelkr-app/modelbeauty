"use client";

// ============================================================
// /mypage/orders — 주문 내역 페이지
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import OrderCard from "@/components/mypage/OrderCard";
import type { OrderStatus } from "@/types";

interface OrderData {
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchOrders = useCallback(async (p: number, append = false) => {
    if (p === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const res = await fetch(`/api/mypage/orders?page=${p}`);
      const { data } = await res.json();
      if (append) {
        setOrders((prev) => [...prev, ...(data?.orders ?? [])]);
      } else {
        setOrders(data?.orders ?? []);
      }
      setTotal(data?.total ?? 0);
      setHasMore(data?.hasMore ?? false);
    } catch {
      //
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchOrders(nextPage, true);
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h1 className="mypage-section-title" style={{ margin: 0 }}>
          주문 내역
        </h1>
        {total > 0 && (
          <span
            style={{
              fontSize: "0.9rem",
              color: "var(--mb-gray-400)",
              fontWeight: 500,
            }}
          >
            총 {total}건
          </span>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "180px", borderRadius: "20px" }}
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="order-empty">
          <div className="order-empty-icon" aria-hidden="true">📦</div>
          <h3>아직 주문 내역이 없습니다</h3>
          <p>마음에 드는 상품을 구매해보세요!</p>
          <Link href="/products" className="hero-cta-primary">
            쇼핑하러 가기
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                style={{
                  padding: "0.75rem 2.5rem",
                  background: "#fff",
                  border: "1.5px solid var(--mb-gray-200)",
                  borderRadius: "100px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--mb-gray-600)",
                  cursor: isLoadingMore ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  opacity: isLoadingMore ? 0.6 : 1,
                }}
              >
                {isLoadingMore ? "불러오는 중..." : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

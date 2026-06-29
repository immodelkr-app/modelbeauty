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
  const { masterUser, setMasterUser } = useAuthStore();
  const { items: wishlistItems } = useWishlistStore();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // 닉네임 수정
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

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

  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      setIsLoggingOut(true);
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (res.ok) {
          setMasterUser(null);
          window.location.href = "/";
        }
      } catch {
        alert("로그아웃 중 오류가 발생했습니다.");
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleNicknameEdit = () => {
    setNicknameInput(masterUser?.name ?? "");
    setNicknameError("");
    setIsEditingNickname(true);
  };

  const handleNicknameSave = async () => {
    const trimmed = nicknameInput.trim();
    if (trimmed.length < 2) { setNicknameError("닉네임은 2자 이상이어야 합니다."); return; }
    if (trimmed.length > 12) { setNicknameError("닉네임은 12자 이하이어야 합니다."); return; }
    setIsSavingNickname(true);
    try {
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: masterUser?.masterUserId,
          name: trimmed,
        }),
      });
      if (res.ok) {
        // 로컈 스토어도 즉시 반영
        if (masterUser) setMasterUser({ ...masterUser, name: trimmed });
        setIsEditingNickname(false);
      } else {
        setNicknameError("저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setNicknameError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingNickname(false);
    }
  };

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
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div>
          {isEditingNickname ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  maxLength={12}
                  autoFocus
                  style={{
                    fontSize: "1rem", fontWeight: 700,
                    border: "2px solid var(--mb-pink-400)",
                    borderRadius: "8px", padding: "0.375rem 0.625rem",
                    outline: "none", width: "140px",
                  }}
                />
                <button
                  onClick={handleNicknameSave}
                  disabled={isSavingNickname}
                  style={{
                    background: "var(--mb-pink-500)", color: "#fff",
                    border: "none", borderRadius: "8px",
                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                    fontWeight: 600, cursor: "pointer"
                  }}
                >{isSavingNickname ? "저장 중" : "확인"}</button>
                <button
                  onClick={() => setIsEditingNickname(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--mb-gray-300)",
                    borderRadius: "8px", padding: "0.375rem 0.625rem",
                    fontSize: "0.8125rem", cursor: "pointer", color: "var(--mb-gray-500)"
                  }}
                >취소</button>
              </div>
              {nicknameError && <p style={{ color: "#ef4444", fontSize: "0.8125rem", margin: 0 }}>{nicknameError}</p>}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <h1 className="mypage-section-title" style={{ margin: 0 }}>
                안녕하세요, {masterUser?.name ?? "회원"}님 👋
              </h1>
              <button
                onClick={handleNicknameEdit}
                title="닉네임 변경"
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", fontSize: "0.875rem",
                  color: "var(--mb-gray-400)", padding: "0.25rem",
                  lineHeight: 1,
                }}
              >✏️</button>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            background: "transparent",
            border: "1px solid var(--mb-gray-300)",
            color: "var(--mb-gray-600)",
            padding: "0.5rem 0.875rem",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>

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

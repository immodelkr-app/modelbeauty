"use client";

// ============================================================
// /cart — 장바구니 페이지 (Client Component)
// ============================================================

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import CartItemRow from "@/components/cart/CartItem";
import type { Metadata } from "next";

// ── 메타데이터는 서버 컴포넌트에서만 export 가능하므로
// 이 파일은 전체를 클라이언트로 처리하고 layout.tsx에서 title을 지정합니다.

const SHIPPING_FREE_THRESHOLD = 50000;
const SHIPPING_FEE = 3000;

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

export default function CartPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useAuthStore();
  const { items, total, itemCount, isLoading, clearCart } = useCartStore();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id))
  );

  // 선택된 항목 기반 계산
  const selectedItems = useMemo(
    () => items.filter((i) => checkedIds.has(i.id)),
    [items, checkedIds]
  );
  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, i) => s + i.subtotal, 0),
    [selectedItems]
  );
  const selectedCount = useMemo(
    () => selectedItems.reduce((s, i) => s + i.quantity, 0),
    [selectedItems]
  );

  const isAllChecked = items.length > 0 && checkedIds.size === items.length;
  const shippingFee = selectedTotal >= SHIPPING_FREE_THRESHOLD || selectedTotal === 0 ? 0 : SHIPPING_FEE;
  const finalTotal = selectedTotal + shippingFee;
  const remainForFreeShipping = SHIPPING_FREE_THRESHOLD - selectedTotal;

  const toggleAll = () => {
    if (isAllChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleItem = (id: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleClearCart = () => {
    if (window.confirm("장바구니를 모두 비울까요?")) {
      clearCart();
      setCheckedIds(new Set());
    }
  };

  const handleCheckout = () => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/checkout");
      return;
    }
    if (selectedItems.length === 0) return;
    router.push("/checkout");
  };

  // ── 로딩 중 ─────────────────────────────────────────────
  if (authLoading || isLoading) {
    return (
      <div className="cart-page">
        <div className="cart-page-title">
          장바구니
        </div>
        <div className="cart-layout">
          <div className="cart-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="cart-item skeleton"
                style={{ height: "140px", borderRadius: "20px" }}
              />
            ))}
          </div>
          <div
            className="cart-summary skeleton"
            style={{ height: "360px" }}
          />
        </div>
      </div>
    );
  }

  // ── 비로그인 ─────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-icon" aria-hidden="true">🔒</div>
        <h2>로그인이 필요합니다</h2>
        <p>장바구니를 이용하려면 로그인해 주세요.</p>
        <Link href="/login" className="hero-cta-primary">
          로그인하기
        </Link>
      </div>
    );
  }

  // ── 빈 장바구니 ──────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-icon" aria-hidden="true">🛒</div>
        <h2>장바구니가 비어있습니다</h2>
        <p>마음에 드는 상품을 장바구니에 담아보세요.</p>
        <Link href="/products" className="hero-cta-primary">
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  // ── 장바구니 메인 ─────────────────────────────────────────
  return (
    <div className="cart-page">
      <h1 className="cart-page-title">
        장바구니
        <span className="cart-page-title-count">{itemCount}개</span>
      </h1>

      <div className="cart-layout">
        {/* 왼쪽: 아이템 목록 */}
        <div>
          <div className="cart-list">
            {/* 목록 헤더 */}
            <div className="cart-list-header">
              <label className="cart-list-header-check">
                <input
                  type="checkbox"
                  checked={isAllChecked}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "var(--mb-pink-500)",
                  }}
                />
                전체 선택 ({checkedIds.size}/{items.length})
              </label>
              <button
                className="cart-clear-btn"
                onClick={handleClearCart}
                aria-label="장바구니 전체 비우기"
              >
                전체 삭제
              </button>
            </div>

            {/* 아이템 */}
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                checked={checkedIds.has(item.id)}
                onCheckChange={(checked) => toggleItem(item.id, checked)}
              />
            ))}
          </div>
        </div>

        {/* 오른쪽: 주문 요약 */}
        <aside className="cart-summary" aria-label="주문 요약">
          <h2 className="cart-summary-title">주문 요약</h2>

          <div className="cart-summary-row">
            <span className="cart-summary-label">
              선택 상품 ({selectedCount}개)
            </span>
            <span className="cart-summary-value">
              {formatPrice(selectedTotal)}
            </span>
          </div>

          <div className="cart-summary-row">
            <span className="cart-summary-label">배송비</span>
            <span className="cart-summary-value">
              {shippingFee === 0 ? (
                <span style={{ color: "var(--mb-pink-500)", fontWeight: 700 }}>
                  무료
                </span>
              ) : (
                formatPrice(shippingFee)
              )}
            </span>
          </div>

          {/* 무료배송 달성 안내 */}
          {selectedTotal > 0 && remainForFreeShipping > 0 && (
            <div
              style={{
                padding: "0.75rem",
                background: "var(--mb-pink-50)",
                borderRadius: "10px",
                marginTop: "0.5rem",
              }}
            >
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--mb-pink-600)",
                  fontWeight: 600,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                🚚 {formatPrice(remainForFreeShipping)} 더 담으면 무료배송!
              </p>
              {/* 진행 바 */}
              <div
                style={{
                  marginTop: "0.5rem",
                  height: "4px",
                  background: "var(--mb-pink-100)",
                  borderRadius: "100px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (selectedTotal / SHIPPING_FREE_THRESHOLD) * 100)}%`,
                    background: "var(--mb-gradient)",
                    borderRadius: "100px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          )}

          <div className="cart-summary-divider" role="separator" />

          <div className="cart-summary-total-row">
            <span className="cart-summary-total-label">총 결제금액</span>
            <span className="cart-summary-total-value">
              {formatPrice(finalTotal)}
            </span>
          </div>

          {/* 포인트 적립 예상 */}
          {finalTotal > 0 && (
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--mb-gray-400)",
                textAlign: "right",
                margin: "0 0 0.5rem",
              }}
            >
              ✨ 구매 시{" "}
              <strong style={{ color: "var(--mb-pink-500)" }}>
                {Math.floor(finalTotal * 0.01).toLocaleString("ko-KR")}P
              </strong>{" "}
              적립
            </p>
          )}

          <button
            className="cart-checkout-btn"
            disabled={selectedItems.length === 0}
            onClick={handleCheckout}
            aria-label={`${selectedItems.length}개 상품 구매하기`}
          >
            {selectedItems.length === 0
              ? "상품을 선택해 주세요"
              : `${selectedCount}개 구매하기`}
          </button>

          <Link href="/products" className="cart-continue-link">
            쇼핑 계속하기 →
          </Link>
        </aside>
      </div>
    </div>
  );
}

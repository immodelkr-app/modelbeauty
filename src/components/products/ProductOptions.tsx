"use client";

// ============================================================
// ProductOptions — 상품 옵션 선택 + 수량 + CTA 버튼 (클라이언트)
// 장바구니/위시리스트 store 연동
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart.store";
import { useWishlistStore } from "@/store/wishlist.store";
import { useAuthStore } from "@/store/auth.store";
import type { ProductOption, ProductVariant } from "@/types";

interface ProductOptionsProps {
  productId: string;
  options: ProductOption[];
  variants: ProductVariant[];
  basePrice: number;
  salePrice: number | null;
  stockQuantity: number;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

// ── 토스트 훅 ─────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
  icon: string;
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = (message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    setToasts((prev) => [...prev, { id, message, type, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return { toasts, show };
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function ProductOptions({
  productId,
  options,
  variants,
  basePrice,
  salePrice,
  stockQuantity,
}: ProductOptionsProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();
  const { addItem: addToCart } = useCartStore();
  const { toggleWishlist, isWishlisted } = useWishlistStore();
  const { toasts, show } = useToast();

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const wished = isWishlisted(productId);
  const hasOptions = options.length > 0;
  const hasVariants = variants.length > 0;

  // 현재 선택된 옵션에 맞는 변형 찾기
  const selectedVariant = hasVariants
    ? variants.find((v) =>
        Object.entries(selectedOptions).every(
          ([key, val]) => v.optionValues[key] === val
        )
      )
    : undefined;

  const availableStock = selectedVariant?.stockQuantity ?? stockQuantity;
  const isOutOfStock = availableStock <= 0;

  const baseDisplayPrice = salePrice ?? basePrice;
  const finalPrice = selectedVariant
    ? baseDisplayPrice + selectedVariant.priceAdjustment
    : baseDisplayPrice;

  const allOptionsSelected =
    !hasOptions || options.every((opt) => selectedOptions[opt.name] !== undefined);

  const selectOption = (optionName: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [optionName]: value }));
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (!allOptionsSelected) {
      show("옵션을 선택해 주세요.", "error");
      return;
    }
    if (isOutOfStock) return;

    setIsAddingToCart(true);
    const result = await addToCart(
      productId,
      selectedVariant?.id,
      quantity
    );
    setIsAddingToCart(false);

    if (result.success) {
      show("장바구니에 담겼습니다. 🛒", "success");
    } else {
      show(result.message, "error");
    }
  };

  const handleBuyNow = async () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (!allOptionsSelected) {
      show("옵션을 선택해 주세요.", "error");
      return;
    }
    // 먼저 장바구니에 추가 후 checkout으로 이동 (Phase 5)
    show("Phase 5에서 결제 기능이 추가될 예정입니다.", "info");
  };

  const handleWishlistToggle = () => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    toggleWishlist(productId);
    show(
      wished ? "위시리스트에서 제거되었습니다." : "위시리스트에 추가되었습니다. ❤️",
      "success"
    );
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* 옵션 선택 */}
        {hasOptions && (
          <div className="product-options">
            {options.map((option) => (
              <div key={option.id} className="product-option-group">
                <label className="product-option-label">
                  {option.name}
                  {selectedOptions[option.name] && (
                    <span className="product-option-selected">
                      : {selectedOptions[option.name]}
                    </span>
                  )}
                </label>
                <div className="product-option-values">
                  {(option.values as string[]).map((value) => {
                    const relatedVariants = variants.filter(
                      (v) => v.optionValues[option.name] === value
                    );
                    const isUnavailable =
                      hasVariants &&
                      relatedVariants.length > 0 &&
                      relatedVariants.every(
                        (v) => v.stockQuantity <= 0 || !v.isActive
                      );

                    return (
                      <button
                        key={value}
                        className={`product-option-btn ${
                          selectedOptions[option.name] === value ? "active" : ""
                        }`}
                        onClick={() => selectOption(option.name, value)}
                        disabled={isUnavailable}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 수량 선택 */}
        <div className="product-quantity-wrap">
          <p className="product-quantity-label">수량</p>
          <div className="product-quantity-ctrl">
            <button
              className="product-quantity-btn"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="수량 감소"
            >
              −
            </button>
            <input
              className="product-quantity-val"
              type="number"
              min={1}
              max={availableStock}
              value={quantity}
              readOnly
              aria-label="수량"
            />
            <button
              className="product-quantity-btn"
              onClick={() =>
                setQuantity((q) => Math.min(availableStock, q + 1))
              }
              disabled={quantity >= availableStock || isOutOfStock}
              aria-label="수량 증가"
            >
              +
            </button>
          </div>
          {selectedVariant && selectedVariant.priceAdjustment !== 0 && (
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--mb-gray-500)",
                margin: 0,
              }}
            >
              옵션 추가금액:{" "}
              {selectedVariant.priceAdjustment > 0 ? "+" : ""}
              {formatPrice(selectedVariant.priceAdjustment)}
            </p>
          )}
        </div>

        {/* 총 금액 */}
        <div
          style={{
            padding: "1rem",
            background: "var(--mb-gray-50)",
            borderRadius: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.875rem",
              color: "var(--mb-gray-500)",
              fontWeight: 500,
            }}
          >
            총 상품금액
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 900,
              color: "var(--mb-gray-900)",
              letterSpacing: "-0.03em",
            }}
          >
            {formatPrice(finalPrice * quantity)}
          </span>
        </div>

        {/* CTA 버튼 */}
        <div className="product-cta-wrap">
          <button
            className="product-btn-cart"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAddingToCart}
            aria-label="장바구니 담기"
          >
            {isAddingToCart ? "담는 중..." : isOutOfStock ? "품절" : "장바구니"}
          </button>
          <button
            className="product-btn-buy"
            onClick={handleBuyNow}
            disabled={isOutOfStock}
            aria-label="바로 구매"
          >
            {isOutOfStock ? "품절" : "바로 구매"}
          </button>
          <button
            className={`product-btn-wishlist${wished ? " wishlist-btn-active" : ""}`}
            onClick={handleWishlistToggle}
            aria-label={wished ? "위시리스트에서 제거" : "위시리스트에 추가"}
            aria-pressed={wished}
          >
            <svg
              viewBox="0 0 24 24"
              fill={wished ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span className="toast-icon" aria-hidden="true">
                {toast.icon}
              </span>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

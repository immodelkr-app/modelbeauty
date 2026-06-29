"use client";

// ============================================================
// CartItem — 장바구니 아이템 행 컴포넌트
// ============================================================

import Image from "next/image";
import Link from "next/link";
import { useCartStore, type CartItem as CartItemType } from "@/store/cart.store";

interface CartItemProps {
  item: CartItemType;
  checked: boolean;
  onCheckChange: (checked: boolean) => void;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

export default function CartItem({ item, checked, onCheckChange }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore();
  const { product, variant, quantity, unitPrice, subtotal } = item;

  const firstImage = product?.images?.[0];
  const maxQty = variant?.stockQuantity ?? product?.stockQuantity ?? 99;

  const handleQtyDecrease = () => {
    if (quantity <= 1) return;
    updateQuantity(item.id, quantity - 1);
  };

  const handleQtyIncrease = () => {
    if (quantity >= maxQty) return;
    updateQuantity(item.id, quantity + 1);
  };

  const handleDelete = () => {
    removeItem(item.id);
  };

  // 옵션값 배열로 변환
  const optionEntries = variant?.optionValues
    ? Object.entries(variant.optionValues)
    : [];

  return (
    <div className="cart-item">
      {/* 체크박스 */}
      <input
        type="checkbox"
        className="cart-item-checkbox"
        checked={checked}
        onChange={(e) => onCheckChange(e.target.checked)}
        aria-label={`${product?.name ?? "상품"} 선택`}
      />

      {/* 이미지 */}
      <div className="cart-item-image">
        {firstImage ? (
          <Image
            src={firstImage.url}
            alt={firstImage.alt || product?.name || "상품"}
            fill
            sizes="100px"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span aria-hidden="true">💄</span>
        )}
      </div>

      {/* 정보 + 컨트롤 */}
      <div className="cart-item-info">
        {product?.category && (
          <p className="cart-item-category">{product.category.name}</p>
        )}

        <Link
          href={product ? `/products/${product.slug}` : "#"}
          className="cart-item-name"
        >
          {product?.name ?? "상품 정보 없음"}
        </Link>

        {optionEntries.length > 0 && (
          <div className="cart-item-option">
            {optionEntries.map(([key, value]) => (
              <span key={key} className="cart-item-option-tag">
                {key}: {value}
              </span>
            ))}
          </div>
        )}

        {/* 수량 + 삭제 (항상 표시) */}
        <div className="cart-item-controls">
          <div className="cart-qty-ctrl" role="group" aria-label="수량 조절">
            <button
              className="cart-qty-btn"
              onClick={handleQtyDecrease}
              disabled={quantity <= 1}
              aria-label="수량 감소"
            >
              −
            </button>
            <div className="cart-qty-val" aria-label={`수량: ${quantity}`}>
              {quantity}
            </div>
            <button
              className="cart-qty-btn"
              onClick={handleQtyIncrease}
              disabled={quantity >= maxQty}
              aria-label="수량 증가"
            >
              +
            </button>
          </div>

          {/* 모바일용 가격 */}
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "var(--mb-gray-900)",
              letterSpacing: "-0.02em",
            }}
            aria-label={`소계 ${formatPrice(subtotal)}`}
          >
            {formatPrice(subtotal)}
          </span>

          <button
            className="cart-item-delete-btn"
            onClick={handleDelete}
            aria-label={`${product?.name ?? "상품"} 삭제`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* 데스크탑 가격 (우측) */}
      <div className="cart-item-price-wrap">
        <span className="cart-item-price">{formatPrice(subtotal)}</span>
        {quantity > 1 && (
          <span className="cart-item-unit-price">
            {formatPrice(unitPrice)} × {quantity}
          </span>
        )}
      </div>
    </div>
  );
}

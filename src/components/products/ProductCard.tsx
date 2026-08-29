// ============================================================
// ProductCard — 상품 카드 컴포넌트
// 위시리스트 토글: wishlist store 연동 (Client)
// ============================================================

"use client";

import Link from "next/link";
import Image from "next/image";
import { useWishlistStore } from "@/store/wishlist.store";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  variant?: "default" | "compact";
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

function calcDiscountRate(base: number, sale: number): number {
  return Math.round(((base - sale) / base) * 100);
}

export default function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const { toggleWishlist, isWishlisted } = useWishlistStore();
  const { isLoggedIn } = useAuthStore();
  const router = useRouter();

  const displayPrice = product.salePrice ?? product.basePrice;
  const hasDiscount = product.salePrice !== null && product.salePrice < product.basePrice;
  const discountRate = hasDiscount ? calcDiscountRate(product.basePrice, product.salePrice!) : 0;
  const firstImage = product.images?.[0];
  const wished = isWishlisted(product.id);

  const isNew =
    Date.now() - new Date(product.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    toggleWishlist(product.id);
  };

  return (
    <Link
      href={`/products/${product.slug}`}
      className={`product-card${variant === "compact" ? " product-card-compact" : ""}`}
    >
      {/* 상품 이미지 */}
      <div className="product-card-image">
        {firstImage ? (
          <Image
            src={firstImage.url}
            alt={firstImage.alt || product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="product-card-image-placeholder">💄</div>
        )}

        {/* 뱃지 */}
        <div className="product-card-badges">
          {isNew && <span className="product-badge product-badge-new">NEW</span>}
          {hasDiscount && (
            <span className="product-badge product-badge-sale">
              {discountRate}% OFF
            </span>
          )}
          {product.isFeatured && (
            <span className="product-badge product-badge-best">BEST</span>
          )}
        </div>

        {/* 위시리스트 버튼 */}
        <button
          className={`product-card-wishlist${wished ? " wishlist-btn-active" : ""}`}
          aria-label={wished ? "위시리스트에서 제거" : "위시리스트에 추가"}
          aria-pressed={wished}
          onClick={handleWishlistToggle}
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

      {/* 상품 정보 */}
      <div className="product-card-body">
        {product.category && (
          <p className="product-card-category">{product.category.name}</p>
        )}
        <h3 className="product-card-name">{product.name}</h3>

        <div className="product-card-price-wrap">
          <span className="product-card-price">{formatPrice(displayPrice)}</span>
          {hasDiscount && (
            <>
              <span className="product-card-price-original">
                {formatPrice(product.basePrice)}
              </span>
              <span className="product-card-discount">{discountRate}%</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── 스켈레톤 로더 ─────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="product-card-skeleton">
      <div className="product-card-skeleton-image skeleton" />
      <div className="product-card-skeleton-body">
        <div className="skeleton" style={{ height: "12px", width: "40%", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "16px", width: "85%", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "16px", width: "60%", borderRadius: "6px" }} />
        <div className="skeleton" style={{ height: "20px", width: "50%", borderRadius: "6px", marginTop: "0.5rem" }} />
      </div>
    </div>
  );
}

"use client";

// ============================================================
// /mypage/wishlist — 위시리스트 페이지
// ============================================================

import Link from "next/link";
import { useWishlistStore } from "@/store/wishlist.store";
import ProductCard from "@/components/products/ProductCard";
import type { Product } from "@/types";

export default function WishlistPage() {
  const { items, isLoading } = useWishlistStore();

  // WishlistItem → Product 타입으로 변환
  const products: Product[] = items
    .filter((item) => item.product !== null)
    .map((item) => {
      const p = item.product!;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: null,
        content: null,
        basePrice: p.basePrice,
        salePrice: p.salePrice,
        stockQuantity: p.stockQuantity,
        sku: null,
        images: p.images,
        tags: [],
        isActive: true,
        isFeatured: p.isFeatured,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        categoryId: p.category?.id ?? null,
        category: p.category
          ? {
              id: p.category.id,
              name: p.category.name,
              slug: p.category.slug,
              parentId: null,
              sortOrder: 0,
              imageUrl: null,
              isActive: true,
              createdAt: "",
            }
          : undefined,
      } satisfies Product;
    });

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
          위시리스트
        </h1>
        {products.length > 0 && (
          <span
            style={{
              fontSize: "0.9rem",
              color: "var(--mb-gray-400)",
              fontWeight: 500,
            }}
          >
            {products.length}개
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mypage-wishlist-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: "320px",
                borderRadius: "20px",
              }}
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="order-empty">
          <div className="order-empty-icon" aria-hidden="true">❤️</div>
          <h3>위시리스트가 비어있습니다</h3>
          <p>마음에 드는 상품의 하트를 눌러 저장해보세요!</p>
          <Link href="/products" className="hero-cta-primary">
            상품 둘러보기
          </Link>
        </div>
      ) : (
        <div className="mypage-wishlist-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}

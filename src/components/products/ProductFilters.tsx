"use client";

// ============================================================
// ProductFilters — 상품 목록 필터/검색/정렬 클라이언트 컴포넌트
// URL searchParams 기반 상태 관리 (Next.js 16)
// ============================================================

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useEffect } from "react";
import type { Category } from "@/types";

interface ProductFiltersProps {
  categories: Category[];
  totalCount: number;
}

export default function ProductFilters({
  categories,
  totalCount,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "latest";
  const currentSearch = searchParams.get("search") ?? "";

  const [searchValue, setSearchValue] = useState(currentSearch);

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== currentSearch) {
        updateParam("search", searchValue || null);
      }
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  // searchParams 외부 변경 시 동기화
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // 검색/필터 변경 시 페이지 초기화
      if (key !== "page") params.delete("page");

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <div>
      {/* 헤더: 제목 + 결과 수 */}
      <div className="products-page-header">
        <h1 className="products-page-title">전체 상품</h1>
        <p className="products-page-count">
          {isPending ? "검색 중..." : `총 ${totalCount.toLocaleString("ko-KR")}개의 상품`}
        </p>
      </div>

      {/* 검색 + 정렬 */}
      <div className="products-controls">
        <div className="products-search-wrap">
          <span className="products-search-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            id="product-search"
            className="products-search-input"
            type="search"
            placeholder="상품 이름 검색..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="상품 검색"
          />
        </div>

        <select
          id="product-sort"
          className="products-sort-select"
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          aria-label="정렬 기준"
        >
          <option value="latest">최신순</option>
          <option value="price_asc">낮은 가격순</option>
          <option value="price_desc">높은 가격순</option>
        </select>
      </div>

      {/* 카테고리 필터 */}
      <div className="category-filters" role="group" aria-label="카테고리 필터">
        <button
          className={`category-filter-btn ${!currentCategory ? "active" : ""}`}
          onClick={() => updateParam("category", null)}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-filter-btn ${currentCategory === cat.slug ? "active" : ""}`}
            onClick={() => updateParam("category", cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

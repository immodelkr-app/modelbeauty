"use client";

// ============================================================
// HeaderShopIcons — 검색/장바구니 아이콘 (로그인 시에만 노출)
// 비로그인 상태에서는 로그인/회원가입 버튼만 보이도록 정리
// ============================================================

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import HeaderCartButton from "@/components/layout/HeaderCartButton";

export default function HeaderShopIcons() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      {/* 검색 */}
      <Link href="/products" className="shop-icon-btn" aria-label="검색">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </Link>

      {/* 장바구니 + 수량 뱃지 */}
      <HeaderCartButton />
    </>
  );
}

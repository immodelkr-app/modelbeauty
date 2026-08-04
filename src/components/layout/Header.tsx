// ============================================================
// Header — 쇼핑몰 공통 상단 네비게이션 (Server Component)
// 장바구니 뱃지: HeaderCartButton(Client)
// 로그인 상태: HeaderAuthSection(Client)
// ============================================================

import Link from "next/link";
import HeaderAuthSection from "@/components/layout/HeaderAuthSection";
import HeaderCartButton from "@/components/layout/HeaderCartButton";

const NAV_ITEMS = [
  { href: "/products", label: "전체 상품" },
  { href: "/products?category=skincare", label: "스킨케어" },
  { href: "/products?category=makeup", label: "메이크업" },
  { href: "/products?category=body", label: "바디" },
  { href: "/products?category=hair", label: "헤어" },
  { href: "/products?featured=true", label: "베스트" },
  { href: "/live", label: "📺 라이브" },
];


export default function Header() {
  return (
    <header className="shop-header">
      <div className="shop-header-inner">
        {/* 로고: 좁은 화면에서는 워드마크 대신 앱 아이콘 배지로 전환 (로그인/회원가입 잘림 방지) */}
        <Link href="/" className="shop-logo" aria-label="MODEL BEAUTY 홈으로">
          <span className="shop-logo-text" aria-hidden="true">MODEL BEAUTY</span>
          <span className="shop-logo-dot" aria-hidden="true" />
          <img
            src="/logo-mark.svg"
            alt=""
            aria-hidden="true"
            className="shop-logo-icon"
            width={32}
            height={32}
          />
        </Link>

        {/* 네비게이션 */}
        <nav className="shop-nav" aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="shop-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 액션 버튼 */}
        <div className="shop-header-actions">
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

          {/* 장바구니 + 수량 뱃지 (Client Component) */}
          <HeaderCartButton />

          {/* 로그인 상태에 따른 UI (Client Component) */}
          <HeaderAuthSection />
        </div>
      </div>
    </header>
  );
}

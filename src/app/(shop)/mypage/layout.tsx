"use client";

// ============================================================
// 마이페이지 레이아웃 — 사이드 프로필 + 네비 + 모바일 탭
// ============================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWishlistStore } from "@/store/wishlist.store";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/mypage",           label: "내 정보",    icon: "👤" },
  { href: "/mypage/orders",    label: "주문 내역",  icon: "📦" },
  { href: "/mypage/wishlist",  label: "위시리스트", icon: "❤️" },
  { href: "/mypage/points",    label: "포인트",     icon: "✨" },
];

export default function MypageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { masterUser, isLoggedIn, isLoading, logout } = useAuthStore();
  const resetCart = useCartStore((s) => s.reset);
  const resetWishlist = useWishlistStore((s) => s.reset);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    logout();
    resetCart();
    resetWishlist();
    router.push("/");
    router.refresh();
  };

  // 로딩 중
  if (isLoading) {
    return (
      <div className="mypage-layout">
        <div
          className="skeleton"
          style={{ height: "320px", borderRadius: "24px" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "120px", borderRadius: "20px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  // 비로그인
  if (!isLoggedIn) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "6rem 1rem",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔒</div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--mb-gray-900)",
            margin: "0 0 0.75rem",
          }}
        >
          로그인이 필요합니다
        </h2>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--mb-gray-500)",
            margin: "0 0 2rem",
            lineHeight: 1.7,
          }}
        >
          마이페이지를 이용하려면 로그인해 주세요.
        </p>
        <Link href="/login" className="hero-cta-primary">
          로그인하기
        </Link>
      </div>
    );
  }

  const initial = masterUser?.name?.[0] ?? masterUser?.phoneNumber?.slice(-2) ?? "M";
  const phone = masterUser?.phoneNumber
    ? masterUser.phoneNumber.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3")
    : "";

  return (
    <div className="mypage-layout">
      {/* 사이드바 (데스크탑) */}
      <aside>
        {/* 프로필 카드 */}
        <div className="mypage-profile-card">
          <div className="mypage-avatar" aria-hidden="true">
            {initial}
          </div>
          <div>
            <p className="mypage-profile-name">
              {masterUser?.name ? `${masterUser.name}님` : "회원"}
            </p>
            <p className="mypage-profile-phone">{phone}</p>
          </div>

          {/* 포인트 뱃지 */}
          <Link href="/mypage/points" className="mypage-point-badge" style={{ textDecoration: "none" }}>
            <p className="mypage-point-label">보유 포인트</p>
            <p className="mypage-point-value">
              {(masterUser?.integratedPoints ?? 0).toLocaleString("ko-KR")}
              <span className="mypage-point-unit">P</span>
            </p>
          </Link>

          {/* 사이드 네비 */}
          <nav className="mypage-sidenav" aria-label="마이페이지 메뉴">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/mypage"
                  ? pathname === "/mypage"
                  : pathname.startsWith(item.href);
              const badge =
                item.href === "/mypage/wishlist" && wishlistCount > 0
                  ? wishlistCount
                  : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mypage-sidenav-item${isActive ? " active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="mypage-sidenav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                  {badge && (
                    <span
                      style={{
                        marginLeft: "auto",
                        background: "var(--mb-pink-500)",
                        color: "#fff",
                        fontSize: "0.6875rem",
                        fontWeight: 800,
                        padding: "0.125rem 0.5rem",
                        borderRadius: "100px",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              className="mypage-sidenav-item"
              onClick={handleLogout}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
                textAlign: "left",
                color: "var(--mb-gray-400)",
                marginTop: "0.5rem",
              }}
            >
              <span className="mypage-sidenav-icon" aria-hidden="true">🚪</span>
              로그아웃
            </button>
          </nav>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="mypage-main">
        {/* 모바일 탭 네비 */}
        <nav className="mypage-mobile-tabs" aria-label="마이페이지 탭">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/mypage"
                ? pathname === "/mypage"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mypage-mobile-tab${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </main>
    </div>
  );
}

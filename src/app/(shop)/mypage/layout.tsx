"use client";

// ============================================================
// 마이페이지 레이아웃 — 사이드 프로필 + 네비 + 모바일 탭
// ============================================================

import { useState } from "react";
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
  const { masterUser, setMasterUser, isLoggedIn, isLoading, logout } = useAuthStore();
  const resetCart = useCartStore((s) => s.reset);
  const resetWishlist = useWishlistStore((s) => s.reset);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  // 닉네임 수정
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

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
            {isEditingNickname ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    maxLength={12}
                    autoFocus
                    style={{
                      fontSize: "0.9375rem", fontWeight: 700,
                      border: "2px solid var(--mb-pink-400)",
                      borderRadius: "8px", padding: "0.25rem 0.5rem",
                      outline: "none", width: "100px",
                    }}
                  />
                  <button
                    onClick={handleNicknameSave}
                    disabled={isSavingNickname}
                    style={{
                      background: "var(--mb-pink-500)", color: "#fff",
                      border: "none", borderRadius: "8px",
                      padding: "0.25rem 0.5rem", fontSize: "0.75rem",
                      fontWeight: 600, cursor: "pointer"
                    }}
                  >{isSavingNickname ? "저장 중" : "확인"}</button>
                  <button
                    onClick={() => setIsEditingNickname(false)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--mb-gray-300)",
                      borderRadius: "8px", padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem", cursor: "pointer", color: "var(--mb-gray-500)"
                    }}
                  >취소</button>
                </div>
                {nicknameError && <p style={{ color: "#ef4444", fontSize: "0.75rem", margin: 0 }}>{nicknameError}</p>}
              </div>
            ) : (
              <p className="mypage-profile-name" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                {masterUser?.name ? `${masterUser.name}님` : "회원"}
                <button
                  onClick={handleNicknameEdit}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--mb-gray-200)",
                    cursor: "pointer", fontSize: "0.6875rem",
                    color: "var(--mb-gray-400)", padding: "0.125rem 0.4375rem",
                    borderRadius: "6px",
                  }}
                >수정</button>
              </p>
            )}
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

"use client";

// ============================================================
// HeaderAuthSection — 로그인 상태에 따른 헤더 우측 UI
// Zustand auth store 구독 (클라이언트 컴포넌트)
// ============================================================

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

export default function HeaderAuthSection() {
  const { isLoggedIn, isLoading, masterUser, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      logout();
      router.push("/");
      router.refresh();
    } catch {
      // 실패해도 store는 초기화
      logout();
      router.push("/");
    }
  };

  // 초기 로딩 중: 스켈레톤
  if (isLoading) {
    return (
      <div
        style={{
          width: "80px",
          height: "32px",
          borderRadius: "100px",
          background: "var(--mb-gray-100)",
          animation: "shimmer 1.5s infinite linear",
          backgroundImage:
            "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
          backgroundSize: "800px 100%",
        }}
        aria-label="로딩 중"
      />
    );
  }

  // 로그인 상태
  if (isLoggedIn && masterUser) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        {/* 마이페이지 */}
        <Link
          href="/mypage"
          className="shop-icon-btn"
          aria-label={`${masterUser.name ?? "마이페이지"} — 내 정보`}
          title={masterUser.name ?? "마이페이지"}
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
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>

        {/* 포인트 표시 */}
        <Link
          href="/points"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0.375rem 0.75rem",
            background: "var(--mb-pink-50)",
            border: "1px solid var(--mb-pink-200)",
            borderRadius: "100px",
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "var(--mb-pink-600)",
            textDecoration: "none",
            gap: "0.25rem",
            transition: "background 0.2s, border-color 0.2s",
            whiteSpace: "nowrap",
          }}
          aria-label={`포인트: ${masterUser.integratedPoints.toLocaleString("ko-KR")}P`}
          title="포인트 내역 보기"
        >
          <span aria-hidden="true">✨</span>
          {masterUser.integratedPoints.toLocaleString("ko-KR")}P
        </Link>

        {/* 로그아웃 */}
        <button
          className="shop-icon-btn"
          onClick={handleLogout}
          aria-label="로그아웃"
          title="로그아웃"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  // 비로그인 상태
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <Link 
        href="/login" 
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--mb-gray-600)",
          textDecoration: "none",
          padding: "0.5rem 0.75rem",
          transition: "color 0.2s"
        }}
        aria-label="로그인"
      >
        로그인
      </Link>
      <Link href="/login?mode=signup" className="shop-login-btn" aria-label="회원가입">
        회원가입
      </Link>
    </div>
  );
}

"use client";

// ============================================================
// 관리자 레이아웃 — 다크 사이드바 + 메인 영역
// 비관리자 접근 시 홈으로 리다이렉트
// ============================================================

import "@/app/admin/admin.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { section: "메뉴" },
  { href: "/admin", label: "대시보드", icon: "📊", exact: true },
  { href: "/admin/products", label: "상품 관리", icon: "🛍️" },
  { href: "/admin/categories", label: "카테고리", icon: "🗂️" },
  { href: "/admin/orders", label: "주문 관리", icon: "📦" },
] as const;

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-brand-title">
          <span>💄</span> MODEL BEAUTY
        </div>
        <div className="admin-sidebar-brand-sub">Admin Console</div>
      </div>

      <nav className="admin-nav" aria-label="관리자 메뉴">
        {NAV.map((item) => {
          if ("section" in item) {
            return (
              <div key={item.section} className="admin-nav-section">
                {item.section}
              </div>
            );
          }
          const isActive =
            "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link href="/" className="admin-nav-link" aria-label="쇼핑몰 바로가기">
          <span className="admin-nav-icon" aria-hidden="true">🏪</span>
          쇼핑몰 보기
        </Link>
      </div>
    </aside>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [pageTitle, setPageTitle] = useState("대시보드");

  useEffect(() => {
    // 관리자 권한 확인 (stats API 호출로 간접 확인)
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 403) {
          router.replace("/");
          return;
        }
        setAuthorized(true);
      })
      .catch(() => {
        setAuthorized(true); // 네트워크 오류는 일단 통과
      });
  }, [router]);

  useEffect(() => {
    const titles: Record<string, string> = {
      "/admin": "대시보드",
      "/admin/products": "상품 관리",
      "/admin/categories": "카테고리",
      "/admin/orders": "주문 관리",
    };
    setPageTitle(
      Object.entries(titles).find(([k]) =>
        k === "/admin" ? pathname === "/admin" : pathname.startsWith(k)
      )?.[1] ?? "관리자"
    );
  }, [pathname]);

  // 권한 확인 중
  if (authorized === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fc",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
          <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            권한 확인 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar pathname={pathname} />

      <div className="admin-main">
        {/* 모바일 탑바 */}
        <div className="admin-mobile-topbar">
          <span className="admin-mobile-brand">💄 MB Admin</span>
          <Link
            href="/"
            style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.5)" }}
          >
            쇼핑몰 →
          </Link>
        </div>

        {/* 데스크탑 탑바 */}
        <header className="admin-topbar">
          <h1 className="admin-topbar-title">{pageTitle}</h1>
          <div className="admin-topbar-actions">
            <Link href="/" className="admin-btn admin-btn-secondary admin-btn-sm">
              🏪 쇼핑몰
            </Link>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

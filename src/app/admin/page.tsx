"use client";

// ============================================================
// /admin — 관리자 대시보드
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import OrderStatusBadge from "@/components/mypage/OrderStatusBadge";
import type { OrderStatus } from "@/types";

interface Stats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalOrders: number;
  todayOrders: number;
  todayRevenue: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: string;
    firstProductName: string;
  }[];
}

function formatPrice(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  const STAT_CARDS = stats
    ? [
        { icon: "🛍️", label: "전체 상품", value: stats.totalProducts, sub: `활성 ${stats.activeProducts}개`, href: "/admin/products" },
        { icon: "📦", label: "오늘 주문", value: stats.todayOrders, sub: `총 ${stats.totalOrders}건`, href: "/admin/orders" },
        { icon: "💰", label: "오늘 매출", value: formatPrice(stats.todayRevenue), sub: "결제 완료 기준", href: "/admin/orders" },
        { icon: "⚠️", label: "재고 부족", value: stats.lowStockProducts, sub: "10개 이하 상품", href: "/admin/products?status=active" },
      ]
    : [];

  return (
    <>
      {/* 통계 카드 */}
      <div className="admin-stat-grid">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="admin-stat-card skeleton" style={{ height: "110px" }} />
            ))
          : STAT_CARDS.map((card) => (
              <Link key={card.label} href={card.href} className="admin-stat-card" style={{ textDecoration: "none" }}>
                <div className="admin-stat-icon" aria-hidden="true">{card.icon}</div>
                <div className="admin-stat-label">{card.label}</div>
                <div className="admin-stat-value">{card.value}</div>
                <div className="admin-stat-sub">{card.sub}</div>
              </Link>
            ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        {/* 최근 주문 */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">최근 주문</h2>
            <Link href="/admin/orders" className="admin-btn admin-btn-secondary admin-btn-sm">
              전체 보기 →
            </Link>
          </div>
          <div className="admin-table-wrap">
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
                불러오는 중...
              </div>
            ) : !stats?.recentOrders.length ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">📦</div>
                <p className="admin-empty-title">주문이 없습니다</p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>주문번호</th>
                    <th>상품</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>일시</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="admin-text-mono">{o.orderNumber}</td>
                      <td style={{ maxWidth: "200px" }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {o.firstProductName}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(o.totalAmount)}</td>
                      <td><OrderStatusBadge status={o.status} showIcon={false} /></td>
                      <td style={{ color: "#9ca3af" }}>{formatDate(o.createdAt)}</td>
                      <td>
                        <Link href={`/admin/orders/${o.id}`} className="admin-btn admin-btn-ghost admin-btn-sm">
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>빠른 액션</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
              ＋ 상품 등록
            </Link>
            <Link href="/admin/categories" className="admin-btn admin-btn-secondary">
              🗂️ 카테고리 관리
            </Link>
            <Link href="/admin/orders" className="admin-btn admin-btn-secondary">
              📦 주문 관리
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

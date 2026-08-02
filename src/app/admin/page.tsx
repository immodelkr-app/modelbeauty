"use client";

// ============================================================
// /admin — 관리자 대시보드 (매출 분석 확장판)
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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

interface RevenuePeriod {
  revenue: number;
  orderCount: number;
  prevRevenue: number;
  changeRate: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orderCount: number;
}

interface CategoryRevenue {
  categoryId: string;
  categoryName: string;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  orderCount: number;
  itemCount: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  productImage: string | null;
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
}

interface AnalyticsData {
  revenueSummary: {
    today: RevenuePeriod;
    thisWeek: RevenuePeriod;
    thisMonth: RevenuePeriod;
  };
  dailyRevenue: DailyRevenue[];
  categoryRevenue: CategoryRevenue[];
  topProducts: TopProduct[];
  bestCategory: {
    categoryId: string;
    categoryName: string;
    monthRevenue: number;
    share: number;
  } | null;
}

interface UserStats {
  total: number;
  byTier: { tierId: string; tierName: string; badgeEmoji: string; count: number }[];
  hasModelBeauty: number;
  noModelBeauty: number;
  byApp: Record<string, number>;
}

function formatPrice(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만원`;
  return n.toLocaleString("ko-KR") + "원";
}

function formatPriceFull(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const RANK_EMOJI = ["🥇", "🥈", "🥉", "4", "5"];

type CatTab = "today" | "week" | "month";

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [catTab, setCatTab] = useState<CatTab>("month");
  const [memberStats, setMemberStats] = useState<UserStats | null>(null);
  const [memberStatsLoading, setMemberStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false));

    fetch("/api/admin/stats/sales-analytics")
      .then((r) => r.json())
      .then(({ data }) => setAnalytics(data))
      .finally(() => setAnalyticsLoading(false));

    fetch("/api/admin/users/stats")
      .then((r) => r.json())
      .then(({ stats: s }) => { if (s) setMemberStats(s); })
      .finally(() => setMemberStatsLoading(false));
  }, []);

  const STAT_CARDS = stats
    ? [
        { icon: "🛍️", label: "전체 상품", value: stats.totalProducts, sub: `활성 ${stats.activeProducts}개`, href: "/admin/products" },
        { icon: "📦", label: "오늘 주문", value: stats.todayOrders, sub: `총 ${stats.totalOrders}건`, href: "/admin/orders" },
        { icon: "💰", label: "오늘 매출", value: formatPriceFull(stats.todayRevenue), sub: "결제 완료 기준", href: "/admin/orders" },
        { icon: "⚠️", label: "재고 부족", value: stats.lowStockProducts, sub: "10개 이하 상품", href: "/admin/products?status=active" },
      ]
    : [];

  // 바 차트 높이 계산
  const maxRevenue = analytics?.dailyRevenue
    ? Math.max(...analytics.dailyRevenue.map((d) => d.revenue), 1)
    : 1;

  const getCatRevenue = (cat: CategoryRevenue) => {
    if (catTab === "today") return cat.todayRevenue;
    if (catTab === "week") return cat.weekRevenue;
    return cat.monthRevenue;
  };

  const sortedCategories = analytics?.categoryRevenue
    ? [...analytics.categoryRevenue].sort((a, b) => getCatRevenue(b) - getCatRevenue(a))
    : [];

  const maxCatRevenue = sortedCategories[0] ? getCatRevenue(sortedCategories[0]) : 1;

  const maxTopRevenue = analytics?.topProducts?.[0]?.totalRevenue ?? 1;

  return (
    <>
      {/* ── 기본 통계 카드 ─── */}
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

      {/* ── 회원 현황 카드 ──────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "1.125rem 1.5rem",
          display: "flex", flexWrap: "wrap", gap: "0", alignItems: "stretch",
        }}>
          {/* 제목 + 버튼 */}
          <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              👥 회원 현황
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Link
                href="/admin/users?action=create"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: "linear-gradient(135deg, #ec4899, #a855f7)",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "7px",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  boxShadow: "0 2px 8px rgba(236,72,153,0.35)",
                  transition: "opacity 0.15s",
                }}
              >
                ➕ 회원 등록
              </Link>
              <Link href="/admin/users" style={{ fontSize: "0.75rem", color: "#ec4899", fontWeight: 600, textDecoration: "none" }}>
                회원관리 →
              </Link>
            </div>
          </div>

          {memberStatsLoading ? (
            <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
              {[1,2,3,4].map((i) => (
                <div key={i} className="skeleton" style={{ height: "56px", flex: 1, borderRadius: "10px" }} />
              ))}
            </div>
          ) : memberStats ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem", width: "100%" }}>
              {/* 전체 인원 */}
              <div style={{
                display: "flex", flexDirection: "column",
                padding: "0.5rem 1rem", borderRadius: "10px",
                background: "rgba(236,72,153,0.08)",
                border: "1px solid rgba(236,72,153,0.2)",
                minWidth: "90px",
              }}>
                <span style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600 }}>전체</span>
                <span style={{ fontSize: "1.375rem", fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
                  {memberStats.total.toLocaleString()}<span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "2px" }}>명</span>
                </span>
              </div>

              {/* 등급별 */}
              {memberStats.byTier.map((t) => (
                <div key={t.tierId} style={{
                  display: "flex", flexDirection: "column",
                  padding: "0.5rem 1rem", borderRadius: "10px",
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.16)",
                  minWidth: "80px",
                }}>
                  <span style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600 }}>{t.badgeEmoji} {t.tierName}</span>
                  <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#4338ca", lineHeight: 1.2 }}>
                    {t.count.toLocaleString()}<span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "2px" }}>명</span>
                  </span>
                  <span style={{ fontSize: "0.6rem", color: "#4f46e5", fontWeight: 600, marginTop: "1px" }}>
                    {memberStats.total > 0 ? Math.round((t.count / memberStats.total) * 100) : 0}%
                  </span>
                </div>
              ))}

              {/* 구분선 */}
              <div style={{ width: "1px", background: "#e5e7eb", margin: "0 0.125rem", alignSelf: "stretch" }} />

              {/* 모델뷰티 가입 */}
              <div style={{
                display: "flex", flexDirection: "column",
                padding: "0.5rem 1rem", borderRadius: "10px",
                background: "rgba(236,72,153,0.06)",
                border: "1px solid rgba(236,72,153,0.16)",
                minWidth: "80px",
              }}>
                <span style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600 }}>🩷 모델뷰티</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#db2777", lineHeight: 1.2 }}>
                  {memberStats.hasModelBeauty.toLocaleString()}<span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "2px" }}>명</span>
                </span>
              </div>

              {/* 미가입 */}
              {memberStats.noModelBeauty > 0 && (
                <div style={{
                  display: "flex", flexDirection: "column",
                  padding: "0.5rem 1rem", borderRadius: "10px",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.16)",
                  minWidth: "80px",
                }}>
                  <span style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600 }}>⚠️ 미가입</span>
                  <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#dc2626", lineHeight: 1.2 }}>
                    {memberStats.noModelBeauty.toLocaleString()}<span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "2px" }}>명</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "#6b7280", fontSize: "0.8125rem" }}>회원 통계를 불러오지 못했습니다.</div>
          )}
        </div>
      </div>

      {/* ── 매출 요약 카드 3개 ─── */}
      <div className="admin-analytics-section">
        {analyticsLoading ? (
          <div className="admin-revenue-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="admin-revenue-card admin-revenue-card-today skeleton" style={{ height: "140px" }} />
            ))}
          </div>
        ) : analytics ? (
          <div className="admin-revenue-grid">
            {/* 일매출 */}
            {(() => {
              const d = analytics.revenueSummary.today;
              return (
                <div className="admin-revenue-card admin-revenue-card-today">
                  <div className="admin-revenue-card-label">📅 일 매출</div>
                  <div className="admin-revenue-card-value">{formatPrice(d.revenue)}</div>
                  <div className="admin-revenue-card-sub">{d.orderCount}건 · 어제 대비</div>
                  <span className={`admin-revenue-change ${d.changeRate >= 0 ? "positive" : "negative"}`}>
                    {d.changeRate >= 0 ? "▲" : "▼"} {Math.abs(d.changeRate)}%
                  </span>
                </div>
              );
            })()}

            {/* 주간매출 */}
            {(() => {
              const d = analytics.revenueSummary.thisWeek;
              return (
                <div className="admin-revenue-card admin-revenue-card-week">
                  <div className="admin-revenue-card-label">📆 주간 매출</div>
                  <div className="admin-revenue-card-value">{formatPrice(d.revenue)}</div>
                  <div className="admin-revenue-card-sub">{d.orderCount}건 · 지난 주 대비</div>
                  <span className={`admin-revenue-change ${d.changeRate >= 0 ? "positive" : "negative"}`}>
                    {d.changeRate >= 0 ? "▲" : "▼"} {Math.abs(d.changeRate)}%
                  </span>
                </div>
              );
            })()}

            {/* 월매출 */}
            {(() => {
              const d = analytics.revenueSummary.thisMonth;
              return (
                <div className="admin-revenue-card admin-revenue-card-month">
                  <div className="admin-revenue-card-label">🗓️ 월 매출</div>
                  <div className="admin-revenue-card-value">{formatPrice(d.revenue)}</div>
                  <div className="admin-revenue-card-sub">{d.orderCount}건 · 전월 대비</div>
                  <span className={`admin-revenue-change ${d.changeRate >= 0 ? "positive" : "negative"}`}>
                    {d.changeRate >= 0 ? "▲" : "▼"} {Math.abs(d.changeRate)}%
                  </span>
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* ── 일별 매출 추이 바 차트 ─── */}
        {analytics && (
          <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-chart-container">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <h2 className="admin-chart-title" style={{ margin: 0 }}>📊 최근 30일 일별 매출 추이</h2>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>결제 완료 기준</span>
              </div>
              <div className="admin-chart-wrap">
                {analytics.dailyRevenue.map((day) => {
                  const heightPct = maxRevenue > 0 ? Math.max((day.revenue / maxRevenue) * 100, day.revenue > 0 ? 3 : 0) : 0;
                  return (
                    <div key={day.date} className="admin-chart-col">
                      <div
                        className={`admin-chart-bar${day.revenue === 0 ? " empty" : ""}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <div className="admin-chart-date">{formatShortDate(day.date)}</div>
                      <div className="admin-chart-tooltip">
                        {formatShortDate(day.date)}<br />
                        {formatPriceFull(day.revenue)}<br />
                        {day.orderCount}건
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 카테고리 매출 + 탑5 상품 2분할 ─── */}
        {analytics && (
          <div className="admin-analytics-grid">
            {/* 카테고리별 매출 */}
            <div className="admin-card" style={{ padding: "1.5rem" }}>
              {/* 베스트 카테고리 하이라이트 */}
              {analytics.bestCategory && (
                <div className="admin-best-category-highlight">
                  <div className="admin-best-category-crown">👑</div>
                  <div className="admin-best-category-info">
                    <div className="admin-best-category-name">{analytics.bestCategory.categoryName}</div>
                    <div className="admin-best-category-meta">이달의 베스트 카테고리 · 점유율 {analytics.bestCategory.share}%</div>
                  </div>
                  <div className="admin-best-category-revenue">{formatPrice(analytics.bestCategory.monthRevenue)}</div>
                </div>
              )}

              {/* 탭 + 테이블 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#111827", margin: 0 }}>카테고리별 매출</h2>
                <div className="admin-tab-group" style={{ width: "auto" }}>
                  {(["today", "week", "month"] as CatTab[]).map((t) => (
                    <button
                      key={t}
                      className={`admin-tab${catTab === t ? " active" : ""}`}
                      onClick={() => setCatTab(t)}
                    >
                      {t === "today" ? "일" : t === "week" ? "주" : "월"}
                    </button>
                  ))}
                </div>
              </div>

              {sortedCategories.length === 0 ? (
                <div className="admin-empty" style={{ padding: "2rem 0" }}>
                  <div className="admin-empty-icon">📂</div>
                  <p className="admin-empty-title">데이터가 없습니다</p>
                </div>
              ) : (
                <div>
                  {sortedCategories.map((cat) => {
                    const rev = getCatRevenue(cat);
                    const pct = maxCatRevenue > 0 ? (rev / maxCatRevenue) * 100 : 0;
                    return (
                      <div key={cat.categoryId} className="admin-category-revenue-row">
                        <div className="admin-category-revenue-top">
                          <span className="admin-category-revenue-name">{cat.categoryName}</span>
                          <span className="admin-category-revenue-amount">{formatPriceFull(rev)}</span>
                        </div>
                        <div className="admin-category-revenue-sub">
                          {cat.orderCount}건 · {cat.itemCount}개 판매
                        </div>
                        <div className="admin-progress-bar-wrap">
                          <div className="admin-progress-bar" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 베스트 상품 TOP 5 */}
            <div className="admin-card" style={{ padding: "1.5rem" }}>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#111827", marginBottom: "1.25rem" }}>
                🏅 베스트 상품 TOP 5 <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#9ca3af" }}>(이번 달 기준)</span>
              </h2>

              {!analytics.topProducts.length ? (
                <div className="admin-empty" style={{ padding: "2rem 0" }}>
                  <div className="admin-empty-icon">📦</div>
                  <p className="admin-empty-title">데이터가 없습니다</p>
                </div>
              ) : (
                <div className="admin-top-products-list">
                  {analytics.topProducts.map((product, idx) => {
                    const pct = maxTopRevenue > 0 ? (product.totalRevenue / maxTopRevenue) * 100 : 0;
                    return (
                      <div key={product.productId}>
                        <div className="admin-top-product-card">
                          <div className={`admin-rank-badge rank-${idx + 1}`}>
                            {RANK_EMOJI[idx]}
                          </div>
                          <div className="admin-top-product-thumb">
                            {product.productImage ? (
                              <Image
                                src={product.productImage}
                                alt={product.productName}
                                fill
                                sizes="44px"
                                style={{ objectFit: "cover" }}
                              />
                            ) : (
                              "💄"
                            )}
                          </div>
                          <div className="admin-top-product-info">
                            <div className="admin-top-product-name">{product.productName}</div>
                            <div className="admin-top-product-meta">{product.totalQuantity}개 판매 · {product.orderCount}건</div>
                          </div>
                          <div className="admin-top-product-revenue">{formatPrice(product.totalRevenue)}</div>
                        </div>
                        {idx < analytics.topProducts.length - 1 && (
                          <div style={{ padding: "0 0.75rem" }}>
                            <div className="admin-progress-bar-wrap" style={{ marginTop: "0.25rem" }}>
                              <div className="admin-progress-bar" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 최근 주문 + 빠른 액션 ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
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
                      <td style={{ fontWeight: 700 }}>{formatPriceFull(o.totalAmount)}</td>
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

"use client";
// /admin/orders — 주문 목록

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  recipientName: string;
  recipientPhone: string;
  createdAt: string;
  itemCount: number;
  firstProductName: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "pending", label: "결제 대기" },
  { value: "paid", label: "결제 완료" },
  { value: "preparing", label: "상품 준비중" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송 완료" },
  { value: "confirmed", label: "구매 확정" },
  { value: "cancelled", label: "취소" },
  { value: "refund_requested", label: "환불 요청" },
  { value: "refunded", label: "환불 완료" },
];

const STATUS_KO: Record<string, string> = {
  pending: "결제 대기", paid: "결제 완료", preparing: "준비중", shipping: "배송중",
  delivered: "배송 완료", confirmed: "구매 확정", cancelled: "취소",
  refund_requested: "환불 요청", refunded: "환불 완료",
};

function formatPrice(n: number) { return n.toLocaleString("ko-KR") + "원"; }
function formatDate(s: string) {
  return new Date(s).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    const res = await fetch(`/api/admin/orders?${qs}`);
    const { data } = await res.json();
    setOrders(data?.orders ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">주문 관리 <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>({total}건)</span></h1>
      </div>

      {/* 필터 */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <span className="admin-search-icon">🔍</span>
          <input className="admin-search" placeholder="주문번호·수령인 검색..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="admin-filter-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : orders.length === 0 ? (
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
                  <th>수령인</th>
                  <th>금액</th>
                  <th>상태</th>
                  <th>일시</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="admin-text-mono" style={{ whiteSpace: "nowrap" }}>{o.orderNumber}</td>
                    <td style={{ maxWidth: "180px" }}>
                      <div style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {o.firstProductName}
                        {o.itemCount > 1 && <span style={{ color: "#9ca3af" }}> 외 {o.itemCount - 1}건</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.recipientName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{o.recipientPhone}</div>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatPrice(o.totalAmount)}</td>
                    <td>
                      <span className={`admin-order-status admin-status-${o.status}`}>
                        {STATUS_KO[o.status] ?? o.status}
                      </span>
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>{formatDate(o.createdAt)}</td>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="admin-btn admin-btn-secondary admin-btn-sm">
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="admin-pagination">
            <span>{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total}건</span>
            <div className="admin-pagination-btns">
              <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 이전</button>
              <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음 →</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

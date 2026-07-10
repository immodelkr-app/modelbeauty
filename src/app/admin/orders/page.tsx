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
  
  // 일괄 선택 및 엑셀 관련 상태
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    summary?: { total: number; success: number; failed: number };
    errors?: { row: number; orderNumber?: string; reason: string }[];
    error?: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

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
    // 데이터 변경 시 선택 상태 리셋
    setSelectedIds([]);
  }, [page, search, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalPages = Math.ceil(total / LIMIT);

  // 일괄 선택 핸들러
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(orders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  // 일괄 상태 변경 실행 (주문 승인 등)
  const handleBulkStatus = async (targetStatus: string) => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    setActionSuccess("");
    try {
      const res = await fetch("/api/admin/orders/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedIds,
          status: targetStatus,
          note: "어드민 일괄 상태 변경",
        }),
      });
      const result = await res.json();
      if (result.success) {
        setActionSuccess(`선택한 ${result.data.updatedCount}건의 주문 상태가 성공적으로 변경되었습니다.`);
        setSelectedIds([]);
        fetchOrders();
        setTimeout(() => setActionSuccess(""), 4000);
      } else {
        alert(result.error ?? "상태 변경 도중 에러가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버와의 통신 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  // 배송용 엑셀 다운로드
  const handleExcelDownload = () => {
    if (selectedIds.length === 0) return;
    const qs = new URLSearchParams({ orderIds: selectedIds.join(",") });
    window.location.href = `/api/admin/orders/excel-download?${qs.toString()}`;
  };

  // 엑셀 송장 업로드
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/shipping/bulk-upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setUploadResult(result);
      if (result.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
      setUploadResult({ success: false, error: "서버 전송 중 오류가 발생했습니다." });
    } finally {
      setUploading(false);
      e.target.value = ""; // 초기화
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">주문 관리 <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>({total}건)</span></h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            className="admin-btn admin-btn-secondary" 
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
            onClick={() => setShowUploadModal(true)}
          >
            📊 송장 일괄 등록 (Excel)
          </button>
        </div>
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

      {/* 처리 결과 메시지 */}
      {actionSuccess && (
        <div className="admin-alert admin-alert-success" style={{ margin: "1rem 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }}>×</button>
        </div>
      )}

      {/* 선택 액션 바 */}
      {selectedIds.length > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0f14, #1f1f2e)",
          padding: "1rem 1.5rem",
          borderRadius: "12px",
          marginBottom: "1rem",
          color: "#fff",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
          animation: "slideDown 0.2s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyItems: "center", background: "#db2777", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", fontSize: "0.75rem", fontWeight: "bold", paddingLeft: "7px" }}>
              {selectedIds.length}
            </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>개의 주문이 선택됨</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              className="admin-btn admin-btn-primary admin-btn-sm" 
              style={{ background: "linear-gradient(135deg, #db2777, #9333ea)", border: "none" }}
              disabled={actionLoading}
              onClick={() => handleBulkStatus("preparing")}
            >
              📦 주문 승인 (준비중으로)
            </button>
            <button 
              className="admin-btn admin-btn-secondary admin-btn-sm"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
              onClick={handleExcelDownload}
            >
              📥 배송용 엑셀 다운
            </button>
            <button 
              className="admin-btn admin-btn-secondary admin-btn-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
              onClick={() => setSelectedIds([])}
            >
              선택 취소
            </button>
          </div>
        </div>
      )}

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
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input 
                      type="checkbox" 
                      style={{ transform: "scale(1.1)", cursor: "pointer" }}
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
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
                  <tr key={o.id} style={{ background: selectedIds.includes(o.id) ? "rgba(219,39,119,0.03)" : "none" }}>
                    <td style={{ textAlign: "center" }}>
                      <input 
                        type="checkbox" 
                        style={{ transform: "scale(1.1)", cursor: "pointer" }}
                        checked={selectedIds.includes(o.id)}
                        onChange={(e) => handleSelectOne(o.id, e.target.checked)}
                      />
                    </td>
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

      {/* 송장 일괄 등록 엑셀 업로드 모달 */}
      {showUploadModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 15, 20, 0.4)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          animation: "fadeIn 0.25s ease-out"
        }}>
          <div style={{
            background: "#fff",
            width: "500px",
            maxWidth: "90%",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            padding: "2rem",
            position: "relative"
          }}>
            {/* 닫기 버튼 */}
            <button 
              onClick={() => { setShowUploadModal(false); setUploadResult(null); }}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                color: "#9ca3af",
                cursor: "pointer"
              }}
            >
              ×
            </button>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              📊 송장 일괄 등록 (Excel)
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "1.5rem" }}>
              수령인 주소록 엑셀 다운로드 파일에 <strong>택배사코드</strong>와 <strong>운송장번호</strong> 컬럼을 채운 후 업로드해 주세요.
            </p>

            {/* 업로드 상태 */}
            {!uploadResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{
                  border: "2px dashed #e5e7eb",
                  borderRadius: "12px",
                  padding: "2.5rem 1rem",
                  textAlign: "center",
                  background: "#f9fafb",
                  cursor: "pointer",
                  position: "relative"
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📁</div>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>엑셀 파일 업로드</span>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>.xlsx 형식만 지원합니다.</p>
                  <input 
                    type="file" 
                    accept=".xlsx"
                    onChange={handleExcelUpload}
                    disabled={uploading}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer"
                    }}
                  />
                </div>
                {uploading && (
                  <div style={{ textAlign: "center", color: "#db2777", fontSize: "0.875rem", fontWeight: 600 }}>
                    🔄 엑셀 파일 분석 중... 잠시만 기다려주세요.
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* 결과 요약 */}
                {uploadResult.success ? (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem" }}>
                    <h3 style={{ color: "#166534", fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.5rem" }}>🎉 업로드 분석 완료</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", fontSize: "0.8125rem", textAlign: "center" }}>
                      <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px" }}>
                        <div style={{ color: "#9ca3af" }}>총 건수</div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827" }}>{uploadResult.summary?.total}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px" }}>
                        <div style={{ color: "#166534" }}>성공</div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#166534" }}>{uploadResult.summary?.success}</div>
                      </div>
                      <div style={{ background: "#fff", padding: "0.5rem", borderRadius: "6px" }}>
                        <div style={{ color: "#991b1b" }}>실패</div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#991b1b" }}>{uploadResult.summary?.failed}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", color: "#991b1b", fontSize: "0.875rem" }}>
                    ⚠️ {uploadResult.error ?? "엑셀 파일 처리에 실패했습니다."}
                  </div>
                )}

                {/* 오류 상세 리스트 */}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div style={{ marginBottom: "1.25rem" }}>
                    <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#374151", marginBottom: "0.375rem" }}>오류 내역 ({uploadResult.errors.length}건)</h4>
                    <div style={{
                      maxHeight: "150px",
                      overflowY: "auto",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      background: "#f9fafb",
                      fontSize: "0.75rem",
                      color: "#4b5563"
                    }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                          <tr>
                            <th style={{ padding: "0.375rem", textAlign: "left" }}>엑셀행</th>
                            <th style={{ padding: "0.375rem", textAlign: "left" }}>주문번호</th>
                            <th style={{ padding: "0.375rem", textAlign: "left" }}>오류 원인</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadResult.errors.map((err, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid #e5e7eb" }}>
                              <td style={{ padding: "0.375rem" }}>{err.row}</td>
                              <td style={{ padding: "0.375rem", fontFamily: "monospace" }}>{err.orderNumber ?? "—"}</td>
                              <td style={{ padding: "0.375rem", color: "#dc2626" }}>{err.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button 
                    className="admin-btn admin-btn-secondary" 
                    onClick={() => setUploadResult(null)}
                    style={{ fontSize: "0.8125rem" }}
                  >
                    다시 업로드
                  </button>
                  <button 
                    className="admin-btn admin-btn-primary" 
                    onClick={() => { setShowUploadModal(false); setUploadResult(null); }}
                    style={{ fontSize: "0.8125rem" }}
                  >
                    완료 및 닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


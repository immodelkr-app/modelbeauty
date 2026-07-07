"use client";

import { useState, useEffect, useCallback } from "react";

interface VendorSettlement {
  id: string;
  yearMonth: string;
  vendorId: string;
  vendorName: string;
  contactName: string;
  contactPhone: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  totalSales: number;
  totalPayout: number;
  payoutStatus: "pending" | "paid" | "withheld";
  note: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ 대기",
  paid: "✅ 지급완료",
  withheld: "⛔ 보류",
};
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fef9c3", color: "#854d0e" },
  paid: { bg: "#dcfce7", color: "#15803d" },
  withheld: { bg: "#fee2e2", color: "#dc2626" },
};

function getYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function VendorSettlementsPage() {
  const [yearMonth, setYearMonth] = useState(getYearMonth());
  const [settlements, setSettlements] = useState<VendorSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchSettlements = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendor-settlements?yearMonth=${ym}`);
      const result = await res.json();
      if (result.success) {
        setSettlements(result.data.settlements ?? []);
        setSelectedIds([]);
      } else {
        alert(result.error ?? "정산 데이터를 불러오는 데 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettlements(yearMonth); }, [yearMonth, fetchSettlements]);

  const handleCalculate = async () => {
    if (!confirm(`${yearMonth} 업체 정산 데이터를 계산하시겠습니까?\n기존 데이터가 덮어씌워집니다.`)) return;
    setCalculating(true);
    try {
      const res = await fetch("/api/admin/vendor-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`✅ ${result.message}`);
        fetchSettlements(yearMonth);
      } else {
        alert(result.error ?? "계산에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setCalculating(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (selectedIds.length === 0) { alert("변경할 항목을 선택해 주세요."); return; }
    if (!confirm(`선택한 ${selectedIds.length}개 업체 정산 상태를 "${STATUS_LABEL[status]}"으로 변경하시겠습니까?`)) return;
    try {
      const res = await fetch("/api/admin/vendor-settlements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ 지급 상태가 변경되었습니다.");
        fetchSettlements(yearMonth);
      } else {
        alert(result.error ?? "상태 변경에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === settlements.length ? [] : settlements.map((s) => s.id));
  };

  const totalSales = settlements.reduce((s, x) => s + x.totalSales, 0);
  const totalPayout = settlements.reduce((s, x) => s + x.totalPayout, 0);

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">업체 정산</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="admin-input"
            style={{ width: "auto", padding: "0.4rem 0.75rem" }}
          />
          <button
            onClick={handleCalculate}
            className="admin-btn admin-btn-primary"
            disabled={calculating}
          >
            {calculating ? "⏳ 계산 중..." : "🔄 정산 계산 실행"}
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      {settlements.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="admin-stat-card">
            <div className="admin-stat-label">업체 수</div>
            <div className="admin-stat-value">{settlements.length}개</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">총 매출 (업체 상품)</div>
            <div className="admin-stat-value" style={{ color: "#2563eb" }}>
              {totalSales.toLocaleString()}원
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">업체 지급 합계</div>
            <div className="admin-stat-value" style={{ color: "#dc2626" }}>
              {totalPayout.toLocaleString()}원
            </div>
          </div>
        </div>
      )}

      {/* 일괄 상태 변경 */}
      {selectedIds.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e40af" }}>
            {selectedIds.length}개 선택됨
          </span>
          <span style={{ color: "#93c5fd" }}>|</span>
          <span style={{ fontSize: "0.8125rem", color: "#374151" }}>상태 변경:</span>
          <button onClick={() => handleStatusChange("paid")} className="admin-btn admin-btn-sm" style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>✅ 지급완료</button>
          <button onClick={() => handleStatusChange("withheld")} className="admin-btn admin-btn-sm" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}>⛔ 보류</button>
          <button onClick={() => handleStatusChange("pending")} className="admin-btn admin-btn-secondary admin-btn-sm">⏳ 대기</button>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : settlements.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">📊</div>
              <p className="admin-empty-title">{yearMonth} 업체 정산 데이터 없음</p>
              <p className="admin-empty-desc">
                &quot;정산 계산 실행&quot; 버튼을 눌러 해당 월의 정산을 계산하세요.<br />
                (구매확정 상태의 라이브 연계 주문이 있어야 데이터가 생성됩니다)
              </p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selectedIds.length === settlements.length} onChange={toggleAll} />
                  </th>
                  <th>업체명</th>
                  <th>담당자</th>
                  <th>정산 계좌</th>
                  <th style={{ textAlign: "right" }}>총 매출</th>
                  <th style={{ textAlign: "right" }}>지급액</th>
                  <th style={{ textAlign: "right" }}>MB 기여</th>
                  <th>지급 상태</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const mbContrib = s.totalSales - s.totalPayout;
                  const col = STATUS_COLOR[s.payoutStatus] ?? STATUS_COLOR.pending;
                  return (
                    <tr key={s.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>{s.vendorName}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.contactName}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.contactPhone}</div>
                      </td>
                      <td style={{ fontSize: "0.78rem" }}>
                        <div>{s.bankName}</div>
                        <div style={{ color: "#6b7280" }}>{s.accountHolder} / {s.accountNumber.slice(0, 4)}****</div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {s.totalSales.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                        {s.totalPayout.toLocaleString()}원
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: mbContrib >= 0 ? "#15803d" : "#dc2626" }}>
                        {mbContrib.toLocaleString()}원
                      </td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "3px 8px", borderRadius: 9999,
                          fontSize: "0.75rem", fontWeight: 700,
                          background: col.bg, color: col.color,
                        }}>
                          {STATUS_LABEL[s.payoutStatus]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

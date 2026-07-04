"use client";

import { useState, useEffect, useCallback } from "react";

interface SettlementRow {
  id: string;
  yearMonth: string;
  crewId: string;
  totalSales: number;
  totalSettlement: number;
  taxAmount: number;
  netPayout: number;
  payoutStatus: "pending" | "paid" | "withheld";
  note: string | null;
  crewName: string;
  crewNickname: string;
  crewPhone: string;
  bankName: string;
  maskedAccountNumber: string;
}

interface TrendItem {
  yearMonth: string;
  totalSales: number;
  totalSettlement: number;
  netPayout: number;
}

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Get current year and previous month (e.g. if July 2026, defaults to 2026-06)
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settlements?yearMonth=${yearMonth}`);
      const result = await res.json();
      if (result.success && result.data) {
        setSettlements(result.data.settlements ?? []);
        setTrends(result.data.trends ?? []);
        setSelectedIds([]);
      } else {
        alert(result.error ?? "정산 정보 로딩 실패");
      }
    } catch (e) {
      console.error(e);
      alert("정산 데이터를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate / Recalculate settlements
  const handleCalculate = async () => {
    const ok = confirm(`${yearMonth} 정산 계산을 실행하시겠습니까?\n기존 내역이 있는 경우 새로 계산되어 업데이트됩니다.`);
    if (!ok) return;

    setCalculating(true);
    try {
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth }),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message || "정산 계산이 완료되었습니다.");
        fetchData();
      } else {
        alert(result.error ?? "정산 계산 중 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("서버 통신 실패");
    } finally {
      setCalculating(false);
    }
  };

  // Change payout status (bulk or single)
  const handleUpdateStatus = async (status: "paid" | "pending" | "withheld", targetIds?: string[]) => {
    const ids = targetIds || selectedIds;
    if (ids.length === 0) {
      alert("대상 항목을 선택해주세요.");
      return;
    }

    const ok = confirm(`선택한 ${ids.length}건의 지급 상태를 [${status === "paid" ? "지급완료" : status === "pending" ? "지급대기" : "보류"}] 상태로 변경하시겠습니까?`);
    if (!ok) return;

    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/admin/settlements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const result = await res.json();
      if (result.success) {
        alert("지급 상태가 업데이트되었습니다.");
        fetchData();
      } else {
        alert(result.error ?? "상태 변경 실패");
      }
    } catch (e) {
      console.error(e);
      alert("서버 통신 실패");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Export to Excel (CSV UTF-8 with BOM)
  const handleExportCSV = () => {
    if (settlements.length === 0) {
      alert("내보낼 정산 데이터가 없습니다.");
      return;
    }

    const headers = ["정산월", "크루명", "닉네임", "연락처", "은행명", "계좌번호(마스킹)", "총 매출액", "세전 정산금", "원천세(3.3%)", "세후 실지급액", "지급 상태"];
    const rows = settlements.map((s) => [
      s.yearMonth,
      s.crewName,
      s.crewNickname,
      s.crewPhone,
      s.bankName,
      s.maskedAccountNumber,
      s.totalSales,
      s.totalSettlement,
      s.taxAmount,
      s.netPayout,
      s.payoutStatus === "paid" ? "지급완료" : s.payoutStatus === "withheld" ? "보류" : "대기",
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // Prepend UTF-8 BOM (\uFEFF) to make it readable in Excel in Korean without encoding issues
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `modelbeauty_settlement_${yearMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(settlements.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Total summary calculations
  const totalSales = settlements.reduce((sum, s) => sum + s.totalSales, 0);
  const totalSettlement = settlements.reduce((sum, s) => sum + s.totalSettlement, 0);
  const totalTax = settlements.reduce((sum, s) => sum + s.taxAmount, 0);
  const totalNetPayout = settlements.reduce((sum, s) => sum + s.netPayout, 0);

  // Maximum value for CSS trend charts sizing
  const maxTrendSales = trends.length > 0 ? Math.max(...trends.map((t) => t.totalSales)) : 1;

  return (
    <>
      {/* 상단 컨트롤 바 */}
      <div className="admin-section-header" style={{ marginBottom: "1.5rem" }}>
        <h1 className="admin-section-title">정산 및 대시보드</h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="month"
            className="admin-input"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            style={{ width: "160px", padding: "0.5rem 0.75rem" }}
          />
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="admin-btn admin-btn-primary"
          >
            {calculating ? "🔄 정산 집계 중..." : "🔄 정산 계산 및 마감"}
          </button>
          <button
            onClick={handleExportCSV}
            className="admin-btn"
            style={{
              borderColor: "#10b981",
              color: "#10b981",
              backgroundColor: "#f0fdf4",
              fontWeight: 700,
            }}
          >
            📥 엑셀(CSV) 다운로드
          </button>
        </div>
      </div>

      {/* 요약 카드 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <div className="summary-stat-card">
          <div className="stat-label">총 연계 매출액 (구매확정)</div>
          <div className="stat-val">{totalSales.toLocaleString("ko-KR")}원</div>
          <div className="stat-indicator" style={{ color: "#10b981" }}>📊 라이브 매출 기준</div>
        </div>
        <div className="summary-stat-card">
          <div className="stat-label">총 정산액 (세전)</div>
          <div className="stat-val" style={{ color: "var(--mb-pink-600)" }}>
            {totalSettlement.toLocaleString("ko-KR")}원
          </div>
          <div className="stat-indicator">👥 크루 배분율 적용액</div>
        </div>
        <div className="summary-stat-card">
          <div className="stat-label">원천세 공제액 (3.3%)</div>
          <div className="stat-val" style={{ color: "#ef4444" }}>
            {totalTax.toLocaleString("ko-KR")}원
          </div>
          <div className="stat-indicator">🏢 국세청 프리랜서 원천세</div>
        </div>
        <div className="summary-stat-card">
          <div className="stat-label">실 지급 합계 (세후)</div>
          <div className="stat-val" style={{ color: "#3b82f6" }}>
            {totalNetPayout.toLocaleString("ko-KR")}원
          </div>
          <div className="stat-indicator" style={{ color: "#3b82f6" }}>💸 크루 실제 통장 송금액</div>
        </div>
      </div>

      {/* 정산 추이 시각화 (Sleek CSS Chart) */}
      {trends.length > 0 && (
        <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem", color: "#1f2937" }}>
            📈 최근 월별 매출 및 정산금 추이
          </h3>
          <div className="chart-container-box">
            {trends.map((t) => {
              const salesPercent = (t.totalSales / maxTrendSales) * 100;
              const settlementPercent = (t.totalSettlement / maxTrendSales) * 100;

              return (
                <div key={t.yearMonth} className="chart-bar-group">
                  <div className="chart-bar-label">{t.yearMonth}</div>
                  <div className="chart-bar-visual-row">
                    {/* 매출 바 */}
                    <div className="chart-bar-wrap">
                      <div
                        className="chart-bar sales-bar"
                        style={{ height: `${Math.max(10, salesPercent)}%` }}
                        title={`매출: ${t.totalSales.toLocaleString()}원`}
                      >
                        <span className="chart-bar-tooltip">{t.totalSales.toLocaleString()}원</span>
                      </div>
                    </div>
                    {/* 정산 바 */}
                    <div className="chart-bar-wrap">
                      <div
                        className="chart-bar settlement-bar"
                        style={{ height: `${Math.max(10, settlementPercent)}%` }}
                        title={`정산: ${t.totalSettlement.toLocaleString()}원`}
                      >
                        <span className="chart-bar-tooltip">{t.totalSettlement.toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "1rem", fontSize: "0.8125rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#6b7280" }}>
              <span style={{ width: "12px", height: "12px", background: "linear-gradient(to top, #db2777, #9333ea)", borderRadius: "2px" }} />
              방송 연계 매출액
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#6b7280" }}>
              <span style={{ width: "12px", height: "12px", background: "linear-gradient(to top, #3b82f6, #60a5fa)", borderRadius: "2px" }} />
              지급 정산금액 (세전)
            </span>
          </div>
        </div>
      )}

      {/* 상세 테이블 내역 */}
      <div className="admin-card">
        {selectedIds.length > 0 && (
          <div
            style={{
              padding: "1rem 1.5rem",
              background: "#eff6ff",
              borderBottom: "1px solid #dbeafe",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: 700 }}>
              선택됨: {selectedIds.length}건
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleUpdateStatus("paid")}
                disabled={updatingStatus}
                className="admin-btn admin-btn-sm"
                style={{ backgroundColor: "#3b82f6", color: "#fff", border: "none", fontWeight: 700 }}
              >
                ✓ 지급완료 처리
              </button>
              <button
                onClick={() => handleUpdateStatus("withheld")}
                disabled={updatingStatus}
                className="admin-btn admin-btn-secondary admin-btn-sm"
                style={{ color: "#ef4444", borderColor: "#fecaca" }}
              >
                ⏸ 지급 보류
              </button>
            </div>
          </div>
        )}

        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
              불러오는 중...
            </div>
          ) : settlements.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">💰</div>
              <p className="admin-empty-title">이 달의 정산 데이터가 없습니다</p>
              <p className="admin-empty-desc">상단의 [정산 계산 및 마감] 버튼을 눌러 집계를 완료해 주세요.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === settlements.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>크루명</th>
                  <th>활동명 (닉네임)</th>
                  <th>은행 정보</th>
                  <th>총 연계 매출액</th>
                  <th>세전 정산금</th>
                  <th>원천세 (3.3%)</th>
                  <th>세후 실지급액</th>
                  <th>지급 상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) => handleSelectRow(s.id, e.target.checked)}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.crewName}</td>
                    <td>{s.crewNickname}</td>
                    <td>
                      <span style={{ fontSize: "0.8125rem", color: "#4b5563" }}>
                        {s.bankName} {s.maskedAccountNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.totalSales.toLocaleString()}원</td>
                    <td style={{ fontWeight: 700, color: "var(--mb-pink-600)" }}>
                      {s.totalSettlement.toLocaleString()}원
                    </td>
                    <td style={{ color: "#ef4444" }}>{s.taxAmount.toLocaleString()}원</td>
                    <td style={{ fontWeight: 700, color: "#3b82f6" }}>
                      {s.netPayout.toLocaleString()}원
                    </td>
                    <td>
                      <span className={`payout-badge badge-${s.payoutStatus}`}>
                        {s.payoutStatus === "paid"
                          ? "🟢 지급완료"
                          : s.payoutStatus === "withheld"
                          ? "🔴 보류"
                          : "⏳ 지급대기"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        {s.payoutStatus !== "paid" ? (
                          <button
                            onClick={() => handleUpdateStatus("paid", [s.id])}
                            className="admin-btn admin-btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", borderColor: "#3b82f6", color: "#3b82f6" }}
                          >
                            지급 완료
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus("pending", [s.id])}
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                          >
                            지급 취소
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 스타일 */}
      <style jsx>{`
        .summary-stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-size: 0.8125rem;
          color: #6b7280;
          font-weight: 500;
          margin-bottom: 0.35rem;
        }
        .stat-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 0.35rem;
        }
        .stat-indicator {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        /* 차트 관련 스타일 */
        .chart-container-box {
          height: 180px;
          display: flex;
          justify-content: space-around;
          align-items: flex-end;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.5rem;
          margin-top: 1rem;
        }
        .chart-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 60px;
          height: 100%;
          justify-content: flex-end;
        }
        .chart-bar-label {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.5rem;
        }
        .chart-bar-visual-row {
          display: flex;
          align-items: flex-end;
          gap: 0.25rem;
          height: calc(100% - 20px);
          width: 100%;
          justify-content: center;
        }
        .chart-bar-wrap {
          height: 100%;
          display: flex;
          align-items: flex-end;
          position: relative;
        }
        .chart-bar {
          width: 12px;
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
          position: relative;
          transition: height 0.4s ease-in-out;
          cursor: pointer;
        }
        .sales-bar {
          background: linear-gradient(to top, #db2777, #9333ea);
        }
        .settlement-bar {
          background: linear-gradient(to top, #3b82f6, #60a5fa);
        }
        
        .chart-bar-tooltip {
          display: none;
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: #fff;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.625rem;
          white-space: nowrap;
          z-index: 10;
          margin-bottom: 4px;
        }
        .chart-bar:hover .chart-bar-tooltip {
          display: block;
        }

        /* 배지 관련 */
        .payout-badge {
          display: inline-flex;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .badge-paid {
          background-color: #f0fdf4;
          color: #16a34a;
        }
        .badge-pending {
          background-color: #fffbeb;
          color: #d97706;
        }
        .badge-withheld {
          background-color: #fef2f2;
          color: #dc2626;
        }
      `}</style>
    </>
  );
}

"use client";

// ============================================================
// /admin/membership — 멤버십 등급 설정 및 재산정 관리
// ============================================================

import { useState, useEffect, useCallback } from "react";

interface MembershipTier {
  id: string;
  name: string;
  sort_order: number;
  min_amount: number;
  discount_rate: number;
  badge_emoji: string;
}

export default function AdminMembershipPage() {
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{
    total: number; upgraded: number; downgraded: number; unchanged: number; recalcAt: string;
  } | null>(null);
  const [editedTiers, setEditedTiers] = useState<MembershipTier[]>([]);

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/membership");
      const result = await res.json();
      if (result.success) {
        setTiers(result.data);
        setEditedTiers(result.data.map((t: MembershipTier) => ({ ...t })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  const handleChange = (id: string, field: "min_amount" | "discount_rate" | "name" | "badge_emoji", value: string | number) => {
    setEditedTiers((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/membership", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: editedTiers.map((t) => ({
            id: t.id,
            name: t.name,
            minAmount: t.min_amount,
            discountRate: t.discount_rate,
            badgeEmoji: t.badge_emoji,
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ 등급 설정이 저장되었습니다.");
        fetchTiers();
      } else {
        alert(result.error ?? "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const isRecalcPeriod = month === 1 || month === 7;

    const confirmMsg = isRecalcPeriod
      ? "전체 회원 등급을 재산정합니다. 최근 6개월 구매액 기준으로 등급이 변경될 수 있습니다.\n\n계속하시겠습니까?"
      : `지금은 재산정 기간(1월/7월)이 아닙니다 (현재: ${month}월).\n그래도 수동으로 등급 재산정을 실행하시겠습니까?`;

    if (!confirm(confirmMsg)) return;

    setRecalculating(true);
    setRecalcResult(null);
    try {
      const res = await fetch("/api/admin/membership", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setRecalcResult(result.result);
        alert(`✅ 등급 재산정 완료!\n승급: ${result.result.upgraded}명 / 강등: ${result.result.downgraded}명 / 유지: ${result.result.unchanged}명`);
      } else {
        alert(result.error ?? "재산정 실패");
      }
    } finally {
      setRecalculating(false);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const isRecalcMonth = currentMonth === 1 || currentMonth === 7;

  return (
    <div className="admin-content-inner">
      {/* 헤더 */}
      <div className="admin-section-header">
        <h1 className="admin-section-title">🏆 멤버십 등급 관리</h1>
      </div>

      {/* 재산정 기간 알림 배너 */}
      {isRecalcMonth && (
        <div style={{
          background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
          border: "1px solid rgba(234,179,8,0.4)", borderRadius: 12, padding: "1rem 1.25rem",
          marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#facc15", fontSize: "0.9375rem" }}>
              📅 {currentMonth === 1 ? "1월" : "7월"} 등급 재산정 기간입니다
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#fef08a", marginTop: 4 }}>
              최근 6개월 구매액을 기준으로 전체 회원 등급을 일괄 재산정하세요. (잠금 회원 제외)
            </div>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            style={{
              background: "#eab308", color: "#000", border: "none", borderRadius: 8,
              padding: "0.625rem 1.25rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {recalculating ? "⏳ 재산정 중..." : "⚡ 등급 재산정 실행"}
          </button>
        </div>
      )}

      {/* 재산정 결과 */}
      {recalcResult && (
        <div className="admin-card" style={{ padding: "1.25rem", marginBottom: "1.5rem", borderLeft: "4px solid #22c55e" }}>
          <div style={{ fontWeight: 700, color: "#22c55e", marginBottom: "0.75rem" }}>✅ 재산정 완료</div>
          <div style={{ display: "flex", gap: "2rem", fontSize: "0.875rem" }}>
            <span>전체: <strong>{recalcResult.total}명</strong></span>
            <span style={{ color: "#22c55e" }}>승급: <strong>{recalcResult.upgraded}명</strong></span>
            <span style={{ color: "#ef4444" }}>강등: <strong>{recalcResult.downgraded}명</strong></span>
            <span style={{ color: "#94a3b8" }}>유지: <strong>{recalcResult.unchanged}명</strong></span>
          </div>
        </div>
      )}

      {/* 등급 설정 테이블 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 className="admin-card-title">등급별 설정 (승급 기준 / 할인율)</h2>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {!isRecalcMonth && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="admin-btn admin-btn-secondary"
                style={{ fontSize: "0.8125rem" }}
              >
                {recalculating ? "⏳ 재산정 중..." : "🔄 수동 재산정"}
              </button>
            )}
            <button onClick={handleSave} disabled={saving} className="admin-btn admin-btn-primary">
              {saving ? "저장 중..." : "💾 설정 저장"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>⏳ 로딩 중...</div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>배지</th>
                  <th>등급명</th>
                  <th>6개월 누적 구매액 기준 (이상)</th>
                  <th>할인율 (%)</th>
                </tr>
              </thead>
              <tbody>
                {editedTiers.map((tier) => (
                  <tr key={tier.id}>
                    <td style={{ fontSize: "1.5rem", textAlign: "center" }}>
                      <input
                        style={{ width: 50, textAlign: "center", background: "transparent", border: "1px solid #334155", borderRadius: 6, color: "#f1f5f9", fontSize: "1.25rem" }}
                        value={tier.badge_emoji}
                        onChange={(e) => handleChange(tier.id, "badge_emoji", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-input"
                        value={tier.name}
                        onChange={(e) => handleChange(tier.id, "name", e.target.value)}
                        style={{ maxWidth: 120 }}
                      />
                    </td>
                    <td>
                      {tier.id === "normal" ? (
                        <span style={{ color: "#64748b" }}>기본 등급 (기준 없음)</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="number"
                            className="admin-input"
                            value={tier.min_amount}
                            onChange={(e) => handleChange(tier.id, "min_amount", parseInt(e.target.value, 10) || 0)}
                            style={{ maxWidth: 140 }}
                            min={0}
                          />
                          <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>원 이상</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="number"
                          className="admin-input"
                          value={tier.discount_rate}
                          onChange={(e) => handleChange(tier.id, "discount_rate", parseFloat(e.target.value) || 0)}
                          style={{ maxWidth: 80 }}
                          min={0}
                          max={100}
                          step={0.5}
                        />
                        <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "#64748b" }}>
          💡 재산정 기간: <strong>매년 1월 1일 / 7월 1일</strong> — 직전 6개월 구매액 기준으로 전체 회원 등급 재산정
        </div>
      </div>
    </div>
  );
}

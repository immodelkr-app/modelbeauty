"use client";
// /admin/coupons — 쿠폰 관리 (템플릿 생성/목록 + 생일 쿠폰 자동발급 설정)

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CouponTemplate {
  id: string;
  name: string;
  discountType: "fixed" | "percent";
  discountValue: number;
}

interface RunResult {
  checked: number;
  matched: number;
  issued: number;
  failed: number;
  skipped: number;
  message?: string;
}

export default function AdminCouponsPage() {
  // 템플릿 목록/생성
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDiscountType, setNewDiscountType] = useState<"fixed" | "percent">("fixed");
  const [newDiscountValue, setNewDiscountValue] = useState("");
  const [newValidityDays, setNewValidityDays] = useState("30");

  // 생일 쿠폰 자동발급
  const [birthdayTemplateId, setBirthdayTemplateId] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/admin/coupons/templates");
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const { data, success } = await res.json();
      if (success) setBirthdayTemplateId(data.birthday_coupon_template_id ?? "");
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchSettings();
  }, [fetchTemplates, fetchSettings]);

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newCode || !newName || !newDiscountValue || !newValidityDays) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/coupons/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          discountType: newDiscountType,
          discountValue: Number(newDiscountValue),
          validityDays: Number(newValidityDays),
        }),
      });
      const { success, error } = await res.json();
      if (!success) {
        setCreateError(error ?? "생성 실패");
        return;
      }
      setNewCode(""); setNewName(""); setNewDiscountValue(""); setNewValidityDays("30");
      fetchTemplates();
    } catch (e) {
      console.error(e);
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveBirthdayTemplate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "birthday_coupon_template_id", value: birthdayTemplateId || null }),
      });
      const { success, error } = await res.json();
      alert(success ? "저장되었습니다." : (error ?? "저장 실패"));
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (!birthdayTemplateId) {
      alert("먼저 생일 쿠폰 템플릿을 선택하고 저장해 주세요.");
      return;
    }
    if (!confirm("지금 실행하면 오늘 생일인 회원에게 실제 쿠폰이 즉시 발급됩니다. 계속할까요?")) return;

    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/cron/birthday-coupons", { method: "POST" });
      const { success, data, error } = await res.json();
      if (success) setRunResult(data);
      else alert(error ?? "실행 실패");
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <div>
          <h1 className="admin-section-title">🎟️ 쿠폰 관리</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "4px" }}>
            쿠폰 템플릿을 만들고, 생일 자동발급을 설정합니다. 특정 회원 1명에게 개별 발급하려면{" "}
            <Link href="/admin/users" style={{ color: "var(--mb-pink-500, #ec4899)", fontWeight: 600 }}>회원 관리</Link>에서 진행하세요.
          </p>
        </div>
      </div>

      {/* 템플릿 생성 */}
      <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>쿠폰 템플릿 만들기</h2>
        <form onSubmit={handleCreateTemplate} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="admin-field" style={{ flex: 1, minWidth: "140px" }}>
            <label className="admin-label admin-label-required">코드</label>
            <input className="admin-input" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} required placeholder="WELCOME5000" />
          </div>
          <div className="admin-field" style={{ flex: 2, minWidth: "160px" }}>
            <label className="admin-label admin-label-required">이름</label>
            <input className="admin-input" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="신규가입 축하 쿠폰" />
          </div>
          <div className="admin-field" style={{ width: "110px" }}>
            <label className="admin-label">할인 유형</label>
            <select className="admin-input" value={newDiscountType} onChange={(e) => setNewDiscountType(e.target.value as "fixed" | "percent")}>
              <option value="fixed">정액(원)</option>
              <option value="percent">정률(%)</option>
            </select>
          </div>
          <div className="admin-field" style={{ width: "110px" }}>
            <label className="admin-label admin-label-required">할인값</label>
            <input type="number" className="admin-input" value={newDiscountValue} onChange={(e) => setNewDiscountValue(e.target.value)} required min={1} placeholder="5000" />
          </div>
          <div className="admin-field" style={{ width: "100px" }}>
            <label className="admin-label admin-label-required">유효일수</label>
            <input type="number" className="admin-input" value={newValidityDays} onChange={(e) => setNewValidityDays(e.target.value)} required min={1} />
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={creating} style={{ alignSelf: "flex-end" }}>
            {creating ? "생성 중..." : "생성"}
          </button>
        </form>
        {createError && <p style={{ color: "#ef4444", fontSize: "0.8125rem", marginTop: "0.75rem" }}>{createError}</p>}
      </div>

      {/* 템플릿 목록 */}
      <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
        <div className="admin-table-wrap">
          {templatesLoading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : templates.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎟️</div>
              <p className="admin-empty-title">등록된 쿠폰 템플릿이 없습니다</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>코드</th>
                  <th>이름</th>
                  <th>할인</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="admin-text-mono">{t.id}</td>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.discountType === "percent" ? `${t.discountValue}%` : `${t.discountValue.toLocaleString()}원`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 생일 쿠폰 자동발급 */}
      <div className="admin-card" style={{ padding: "1.5rem", maxWidth: "560px" }}>
        <h2 className="admin-card-title">🎂 생일 쿠폰 자동발급</h2>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
          매일 오전 9시(KST), 그날 생일인 회원(모델뷰티에 생년월일을 등록한 경우)에게 아래 쿠폰을 자동으로 발급합니다.
          같은 회원에게는 연 1회만 발급됩니다.
        </p>

        {settingsLoading ? (
          <div style={{ color: "#9ca3af", fontSize: "0.875rem" }}>불러오는 중...</div>
        ) : (
          <>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "0.375rem" }}>
              발급할 쿠폰
            </label>
            <select
              className="admin-input"
              value={birthdayTemplateId}
              onChange={(e) => setBirthdayTemplateId(e.target.value)}
              style={{ marginBottom: "0.75rem" }}
            >
              <option value="">선택 안 함 (자동발급 끄기)</option>
              {templatesLoading ? (
                <option disabled>불러오는 중...</option>
              ) : (
                templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
              )}
            </select>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleSaveBirthdayTemplate} disabled={saving} className="admin-btn admin-btn-primary">저장</button>
              <button onClick={handleRunNow} disabled={running} className="admin-btn admin-btn-secondary">
                {running ? "실행 중..." : "🚀 지금 실행 (테스트/누락분 처리)"}
              </button>
            </div>

            {runResult && (
              <div style={{
                marginTop: "1rem", padding: "0.875rem 1rem", borderRadius: "10px",
                background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.8125rem",
              }}>
                {runResult.message ? (
                  <div style={{ color: "#b45309" }}>{runResult.message}</div>
                ) : (
                  <>
                    전체 {runResult.checked}명 확인 · 생일자 {runResult.matched}명 · 발급 {runResult.issued}건
                    {runResult.skipped > 0 && ` · 이미 발급됨 ${runResult.skipped}건`}
                    {runResult.failed > 0 && <span style={{ color: "#dc2626" }}> · 발급 실패 {runResult.failed}건</span>}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

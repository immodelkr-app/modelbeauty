"use client";

// ============================================================
// /admin/settings — 관리자 설정 (생일 쿠폰 자동발급 등)
// ============================================================

import { useState, useEffect, useCallback } from "react";

interface CouponTemplate {
  id: string;
  name: string;
  discountType: string;
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

export default function AdminSettingsPage() {
  const [couponTemplates, setCouponTemplates] = useState<CouponTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [birthdayTemplateId, setBirthdayTemplateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const { data, success } = await res.json();
      if (success) {
        setBirthdayTemplateId(data.birthday_coupon_template_id ?? "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/admin/coupons/templates");
      const data = await res.json();
      setCouponTemplates(data.templates ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
  }, [fetchSettings, fetchTemplates]);

  const handleSaveBirthdayTemplate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "birthday_coupon_template_id", value: birthdayTemplateId || null }),
      });
      const { success, error } = await res.json();
      if (success) {
        alert("저장되었습니다.");
      } else {
        alert(error ?? "저장 실패");
      }
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
      if (success) {
        setRunResult(data);
      } else {
        alert(error ?? "실행 실패");
      }
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>;
  }

  return (
    <>
      <div className="admin-section-header">
        <div>
          <h1 className="admin-section-title">⚙️ 설정</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "4px" }}>
            자동화 기능에 필요한 값들을 관리합니다.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ padding: "1.5rem", maxWidth: "560px" }}>
        <h2 className="admin-card-title">🎂 생일 쿠폰 자동발급</h2>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
          매일 오전 9시(KST), 그날 생일인 회원(모델뷰티에 생년월일을 등록한 경우)에게 아래 쿠폰을 자동으로 발급합니다.
          같은 회원에게는 연 1회만 발급됩니다.
        </p>

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
            couponTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))
          )}
        </select>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={handleSaveBirthdayTemplate}
            disabled={saving}
            className="admin-btn admin-btn-primary"
          >
            저장
          </button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="admin-btn admin-btn-secondary"
          >
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
                {runResult.failed > 0 && (
                  <span style={{ color: "#dc2626" }}> · 발급 실패 {runResult.failed}건</span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

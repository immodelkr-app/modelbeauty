"use client";

import { useState, useEffect, useCallback } from "react";

interface Vendor {
  id: string;
  name: string;
  business_number: string | null;
  representative_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  default_cost_type: "rate" | "fixed";
  default_cost_rate: number;
  default_cost_price: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  name: "",
  businessNumber: "",
  representativeName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  defaultCostType: "rate" as "rate" | "fixed",
  defaultCostRate: 0,
  defaultCostPrice: 0,
  note: "",
  isActive: true,
};

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/vendors");
      const result = await res.json();
      if (result.success) setVendors(result.data ?? []);
      else alert(result.error ?? "업체 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openRegister = () => {
    setEditingVendor(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setForm({
      name: v.name,
      businessNumber: v.business_number ?? "",
      representativeName: v.representative_name ?? "",
      contactName: v.contact_name ?? "",
      contactPhone: v.contact_phone ?? "",
      contactEmail: v.contact_email ?? "",
      bankName: v.bank_name ?? "",
      accountNumber: v.account_number ?? "",
      accountHolder: v.account_holder ?? "",
      defaultCostType: v.default_cost_type,
      defaultCostRate: v.default_cost_rate,
      defaultCostPrice: v.default_cost_price ?? 0,
      note: v.note ?? "",
      isActive: v.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert("업체명은 필수입니다."); return; }

    setSubmitting(true);
    try {
      const url = editingVendor ? `/api/admin/vendors/${editingVendor.id}` : "/api/admin/vendors";
      const method = editingVendor ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchVendors();
        alert(editingVendor ? "✅ 업체 정보가 수정되었습니다." : "✅ 업체가 등록되었습니다.");
      } else {
        alert(result.error ?? "요청 처리에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`"${vendor.name}" 업체를 삭제하시겠습니까?\n연결된 상품이 있으면 삭제가 거부됩니다.`)) return;
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { fetchVendors(); alert("✅ 업체가 삭제되었습니다."); }
      else alert(result.error ?? "삭제에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const setF = (key: keyof typeof EMPTY_FORM, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          업체 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({vendors.length}개 등록됨)
          </span>
        </h1>
        <button onClick={openRegister} className="admin-btn admin-btn-primary">
          ＋ 신규 업체 등록
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : vendors.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🏢</div>
              <p className="admin-empty-title">등록된 업체가 없습니다</p>
              <p className="admin-empty-desc">모델뷰티(자사) 및 입점 업체를 등록해 주세요.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>업체명</th>
                  <th>사업자번호</th>
                  <th>담당자</th>
                  <th>연락처</th>
                  <th>이메일</th>
                  <th>기본 공급 방식</th>
                  <th>정산 은행</th>
                  <th>상태</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td className="admin-text-mono" style={{ fontSize: "0.8rem" }}>
                      {v.business_number ?? "—"}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{v.contact_name ?? "—"}</div>
                      {v.representative_name && v.representative_name !== v.contact_name && (
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>대표: {v.representative_name}</div>
                      )}
                    </td>
                    <td className="admin-text-mono">{v.contact_phone ?? "—"}</td>
                    <td style={{ fontSize: "0.8rem" }}>{v.contact_email ?? "—"}</td>
                    <td>
                      {v.default_cost_type === "rate" ? (
                        <span style={{ color: "#2563eb", fontWeight: 700 }}>
                          원가율 {v.default_cost_rate}%
                        </span>
                      ) : (
                        <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                          공급가 {(v.default_cost_price ?? 0).toLocaleString()}원
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {v.bank_name ? `${v.bank_name} / ${v.account_holder ?? ""}` : "—"}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                        fontSize: "0.75rem", fontWeight: 700,
                        background: v.is_active ? "#dcfce7" : "#f3f4f6",
                        color: v.is_active ? "#15803d" : "#6b7280",
                      }}>
                        {v.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {new Date(v.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          onClick={() => openEdit(v)}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                        >
                          ✏️ 수정
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="admin-btn admin-btn-sm"
                          style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "#fef2f2", fontSize: "0.72rem" }}
                        >
                          🗑️ 삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container" style={{ maxWidth: 680 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingVendor ? "✏️ 업체 정보 수정" : "＋ 신규 업체 등록"}
              </h2>
              <button onClick={() => setShowModal(false)} className="admin-modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1, overflowY: "auto", paddingRight: "6px" }}>

                {/* 업체 기본 정보 */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#374151", marginBottom: "0.75rem" }}>🏢 업체 기본 정보</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="admin-field" style={{ gridColumn: "1/-1" }}>
                      <label className="admin-label admin-label-required">업체명</label>
                      <input className="admin-input" value={form.name} onChange={e => setF("name", e.target.value)} required placeholder="예) ㈜코스맥스, 모델뷰티(자사)" />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">사업자등록번호</label>
                      <input className="admin-input" value={form.businessNumber} onChange={e => setF("businessNumber", e.target.value)} placeholder="000-00-00000" />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">대표자명</label>
                      <input className="admin-input" value={form.representativeName} onChange={e => setF("representativeName", e.target.value)} placeholder="대표자 이름" />
                    </div>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#374151", marginBottom: "0.75rem" }}>👤 담당자 정보 (대표자와 다를 경우 별도 입력)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="admin-field">
                      <label className="admin-label">담당자명</label>
                      <input className="admin-input" value={form.contactName} onChange={e => setF("contactName", e.target.value)} placeholder="담당자 이름" />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">담당자 연락처</label>
                      <input className="admin-input" value={form.contactPhone} onChange={e => setF("contactPhone", e.target.value)} placeholder="010-0000-0000" />
                    </div>
                    <div className="admin-field" style={{ gridColumn: "1/-1" }}>
                      <label className="admin-label">담당자 이메일</label>
                      <input className="admin-input" type="email" value={form.contactEmail} onChange={e => setF("contactEmail", e.target.value)} placeholder="contact@company.com" />
                    </div>
                  </div>
                </div>

                {/* 기본 공급 조건 */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#374151", marginBottom: "0.75rem" }}>💰 기본 공급 조건 (상품 등록 시 기본값으로 사용)</div>
                  <div className="admin-field">
                    <label className="admin-label">공급 방식</label>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                        <input type="radio" name="costType" value="rate" checked={form.defaultCostType === "rate"} onChange={() => setF("defaultCostType", "rate")} />
                        <span>판매가의 % (원가율)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                        <input type="radio" name="costType" value="fixed" checked={form.defaultCostType === "fixed"} onChange={() => setF("defaultCostType", "fixed")} />
                        <span>고정 공급가 (금액)</span>
                      </label>
                    </div>
                  </div>
                  {form.defaultCostType === "rate" ? (
                    <div className="admin-field" style={{ marginTop: "0.5rem" }}>
                      <label className="admin-label">기본 원가율 (%)</label>
                      <input className="admin-input" type="number" min={0} max={100} step={0.1} value={form.defaultCostRate} onChange={e => setF("defaultCostRate", parseFloat(e.target.value) || 0)} style={{ maxWidth: 160 }} />
                      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4 }}>
                        상품 등록 시 이 값이 자동 입력됩니다. 상품별로 개별 조정 가능합니다.
                      </p>
                    </div>
                  ) : (
                    <div className="admin-field" style={{ marginTop: "0.5rem" }}>
                      <label className="admin-label">기본 고정 공급가 (원)</label>
                      <input className="admin-input" type="number" min={0} value={form.defaultCostPrice} onChange={e => setF("defaultCostPrice", parseInt(e.target.value, 10) || 0)} style={{ maxWidth: 160 }} />
                      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4 }}>
                        상품 등록 시 이 값이 자동 입력됩니다. 상품별로 개별 조정 가능합니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* 정산 계좌 */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#374151", marginBottom: "0.75rem" }}>🏦 정산 계좌 정보</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div className="admin-field">
                      <label className="admin-label">정산 은행</label>
                      <input className="admin-input" value={form.bankName} onChange={e => setF("bankName", e.target.value)} placeholder="예) 신한은행" />
                    </div>
                    <div className="admin-field">
                      <label className="admin-label">예금주</label>
                      <input className="admin-input" value={form.accountHolder} onChange={e => setF("accountHolder", e.target.value)} placeholder="예금주명" />
                    </div>
                    <div className="admin-field" style={{ gridColumn: "1/-1" }}>
                      <label className="admin-label">계좌번호</label>
                      <input className="admin-input" value={form.accountNumber} onChange={e => setF("accountNumber", e.target.value)} placeholder="000-000-000000" />
                    </div>
                  </div>
                </div>

                {/* 메모 + 활성 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "start" }}>
                  <div className="admin-field">
                    <label className="admin-label">메모</label>
                    <textarea className="admin-textarea" value={form.note} onChange={e => setF("note", e.target.value)} rows={2} placeholder="계약 조건, 특이사항 등" />
                  </div>
                  <div className="admin-field" style={{ paddingTop: "1.6rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}>
                      <input type="checkbox" checked={form.isActive} onChange={e => setF("isActive", e.target.checked)} />
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>활성</span>
                    </label>
                  </div>
                </div>

              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? "저장 중..." : editingVendor ? "수정 완료" : "업체 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

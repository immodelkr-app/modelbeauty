"use client";

import { useState, useEffect, useCallback } from "react";

interface Campaign {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  campaign_type: "free" | "paid";
  price: number;
  quota: number;
  recruit_start: string;
  recruit_end: string;
  status: "draft" | "recruiting" | "selecting" | "closed";
  applicant_count: number;
  created_at: string;
  products: { name: string; slug: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
}

interface Applicant {
  id: string;
  master_user_id: string;
  channel_url: string;
  message: string | null;
  status: "applied" | "selected" | "rejected";
  applied_at: string;
}

const STATUS_LABEL: Record<Campaign["status"], string> = {
  draft: "임시저장",
  recruiting: "모집중",
  selecting: "선정중",
  closed: "종료",
};
const STATUS_COLOR: Record<Campaign["status"], { bg: string; fg: string }> = {
  draft: { bg: "#f3f4f6", fg: "#6b7280" },
  recruiting: { bg: "#dcfce7", fg: "#15803d" },
  selecting: { bg: "#fef3c7", fg: "#b45309" },
  closed: { bg: "#f3f4f6", fg: "#9ca3af" },
};

const EMPTY_FORM = {
  productId: "",
  title: "",
  description: "",
  campaignType: "free" as "free" | "paid",
  price: 0,
  quota: 5,
  recruitStart: "",
  recruitEnd: "",
  status: "draft" as Campaign["status"],
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminTrialsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [applicantsFor, setApplicantsFor] = useState<Campaign | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trials");
      const result = await res.json();
      if (result.success) setCampaigns(result.data ?? []);
      else alert(result.error ?? "목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetch("/api/admin/products?limit=200&status=active")
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          setProducts((result.data?.products ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      })
      .catch(() => {});
  }, [fetchCampaigns]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const setF = (key: keyof typeof EMPTY_FORM, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId) { alert("상품을 선택해주세요."); return; }
    if (!form.title.trim()) { alert("제목은 필수입니다."); return; }
    if (!form.recruitStart || !form.recruitEnd) { alert("모집 기간을 입력해주세요."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          recruitStart: new Date(form.recruitStart).toISOString(),
          recruitEnd: new Date(form.recruitEnd).toISOString(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchCampaigns();
        alert("✅ 체험단이 개설되었습니다.");
      } else {
        alert(result.error ?? "개설에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (campaign: Campaign, status: Campaign["status"]) => {
    try {
      const res = await fetch(`/api/admin/trials/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (result.success) fetchCampaigns();
      else alert(result.error ?? "상태 변경에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`"${campaign.title}" 체험단을 삭제하시겠습니까? 신청 내역도 함께 삭제됩니다.`)) return;
    try {
      const res = await fetch(`/api/admin/trials/${campaign.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { fetchCampaigns(); alert("✅ 삭제되었습니다."); }
      else alert(result.error ?? "삭제에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const openApplicants = async (campaign: Campaign) => {
    setApplicantsFor(campaign);
    setApplicantsLoading(true);
    try {
      const res = await fetch(`/api/admin/trials/${campaign.id}/applicants`);
      const result = await res.json();
      if (result.success) setApplicants(result.data ?? []);
      else alert(result.error ?? "신청자 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setApplicantsLoading(false);
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          체험단 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({campaigns.length}건)
          </span>
        </h1>
        <button onClick={openCreate} className="admin-btn admin-btn-primary">
          ＋ 체험단 개설
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : campaigns.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎁</div>
              <p className="admin-empty-title">개설된 체험단이 없습니다</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>상품</th>
                  <th>유형</th>
                  <th>정원/신청</th>
                  <th>모집 기간</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, maxWidth: 180 }}>{c.title}</td>
                    <td style={{ fontSize: "0.82rem" }}>{c.products?.name ?? "—"}</td>
                    <td>
                      {c.campaign_type === "free" ? (
                        <span style={{ color: "var(--mb-pink-600, #db2777)", fontWeight: 700, fontSize: "0.8rem" }}>무료</span>
                      ) : (
                        <span style={{ color: "#7c3aed", fontWeight: 700, fontSize: "0.8rem" }}>{c.price.toLocaleString()}원</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>{c.quota}명 / {c.applicant_count}명</td>
                    <td style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {new Date(c.recruit_start).toLocaleDateString("ko-KR")} ~ {new Date(c.recruit_end).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c, e.target.value as Campaign["status"])}
                        style={{
                          fontSize: "0.75rem", fontWeight: 700, padding: "3px 8px", borderRadius: 9999,
                          border: "none", background: STATUS_COLOR[c.status].bg, color: STATUS_COLOR[c.status].fg,
                        }}
                      >
                        {(Object.keys(STATUS_LABEL) as Campaign["status"][]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button onClick={() => openApplicants(c)} className="admin-btn admin-btn-secondary admin-btn-sm">
                          신청자 보기
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="admin-btn admin-btn-sm"
                          style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "#fef2f2", fontSize: "0.72rem" }}
                        >
                          🗑️
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

      {/* 개설 모달 */}
      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container" style={{ maxWidth: 560 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">＋ 체험단 개설</h2>
              <button onClick={() => setShowModal(false)} className="admin-modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", flex: 1, overflowY: "auto" }}>
                <div className="admin-field">
                  <label className="admin-label admin-label-required">상품</label>
                  <select className="admin-input" value={form.productId} onChange={(e) => setF("productId", e.target.value)} required>
                    <option value="">상품 선택</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="admin-field">
                  <label className="admin-label admin-label-required">제목</label>
                  <input className="admin-input" value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="예) OO 세럼 체험단 모집" required />
                </div>

                <div className="admin-field">
                  <label className="admin-label">지원 조건 / 안내</label>
                  <textarea className="admin-textarea" value={form.description} onChange={(e) => setF("description", e.target.value)} rows={3} placeholder="지원 조건, 진행 방식 등을 안내해주세요." />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="admin-field">
                    <label className="admin-label">캠페인 유형</label>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                        <input type="radio" checked={form.campaignType === "free"} onChange={() => setF("campaignType", "free")} />
                        <span>무료</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                        <input type="radio" checked={form.campaignType === "paid"} onChange={() => setF("campaignType", "paid")} />
                        <span>유료(참가비)</span>
                      </label>
                    </div>
                  </div>
                  {form.campaignType === "paid" && (
                    <div className="admin-field">
                      <label className="admin-label">참가비(원)</label>
                      <input className="admin-input" type="number" min={0} value={form.price} onChange={(e) => setF("price", parseInt(e.target.value, 10) || 0)} />
                    </div>
                  )}
                </div>

                <div className="admin-field">
                  <label className="admin-label admin-label-required">모집 정원</label>
                  <input className="admin-input" type="number" min={1} value={form.quota} onChange={(e) => setF("quota", parseInt(e.target.value, 10) || 1)} style={{ maxWidth: 160 }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">모집 시작</label>
                    <input className="admin-input" type="datetime-local" value={form.recruitStart} onChange={(e) => setF("recruitStart", e.target.value)} required />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">모집 종료</label>
                    <input className="admin-input" type="datetime-local" value={form.recruitEnd} onChange={(e) => setF("recruitEnd", e.target.value)} required />
                  </div>
                </div>

                <div className="admin-field">
                  <label className="admin-label">등록 상태</label>
                  <select className="admin-input" value={form.status} onChange={(e) => setF("status", e.target.value)} style={{ maxWidth: 200 }}>
                    <option value="draft">임시저장 (비공개)</option>
                    <option value="recruiting">바로 모집 시작 (공개)</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? "저장 중..." : "체험단 개설"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 신청자 목록 모달 */}
      {applicantsFor && (
        <div className="admin-modal-overlay" onClick={() => setApplicantsFor(null)}>
          <div className="admin-modal-container" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{applicantsFor.title} — 신청자 목록</h2>
              <button onClick={() => setApplicantsFor(null)} className="admin-modal-close-btn">✕</button>
            </div>
            <div className="admin-modal-body" style={{ overflowY: "auto" }}>
              {applicantsLoading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
              ) : applicants.length === 0 ? (
                <div className="admin-empty">
                  <p className="admin-empty-title">아직 신청자가 없습니다</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>채널 링크</th>
                      <th>지원 동기</th>
                      <th>신청일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <a href={a.channel_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: "0.82rem" }}>
                            {a.channel_url}
                          </a>
                        </td>
                        <td style={{ fontSize: "0.8rem", maxWidth: 240 }}>{a.message ?? "—"}</td>
                        <td style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {new Date(a.applied_at).toLocaleString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "1rem" }}>
                선정 처리·결제 안내·알림 발송 기능은 다음 단계에서 추가될 예정입니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

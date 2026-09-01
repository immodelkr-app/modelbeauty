"use client";

import { useState, useEffect, useCallback } from "react";
import MultiImageUploader, { type UploadedImage } from "@/components/admin/MultiImageUploader";

interface Campaign {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  content: string | null;
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
  contentText: "",
  contentImages: [] as UploadedImage[],
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

// 상세 안내(글+사진)를 안전한 HTML로 조합 (검증된 업로드 URL만 사용하므로 XSS 위험 없음)
function buildCampaignContentHtml(text: string, images: UploadedImage[]): string | null {
  const parts: string[] = [];
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (text.trim()) {
    parts.push(`<p style="white-space:pre-wrap;line-height:1.7;">${escape(text.trim())}</p>`);
  }
  for (const img of images) {
    parts.push(`<img src="${escape(img.url)}" alt="${escape(img.alt || "")}" style="width:100%;display:block;margin-top:0.75rem;" />`);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

// 저장된 content HTML에서 글/사진을 다시 분리해 수정 화면에 채워준다.
function parseCampaignContent(html: string | null): { text: string; images: UploadedImage[] } {
  if (!html) return { text: "", images: [] };
  const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const textMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const text = textMatch ? unescape(textMatch[1]) : "";
  const images = Array.from(html.matchAll(/<img[^>]*\ssrc="([^"]*)"[^>]*\salt="([^"]*)"[^>]*>/g)).map((m) => ({
    url: m[1],
    alt: unescape(m[2]),
  }));
  return { text, images };
}

export default function AdminTrialsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
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
    setEditingCampaign(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (campaign: Campaign) => {
    const { text, images } = parseCampaignContent(campaign.content);
    setEditingCampaign(campaign);
    setForm({
      productId: campaign.product_id,
      title: campaign.title,
      description: campaign.description ?? "",
      contentText: text,
      contentImages: images,
      campaignType: campaign.campaign_type,
      price: campaign.price,
      quota: campaign.quota,
      recruitStart: toLocalInput(campaign.recruit_start),
      recruitEnd: toLocalInput(campaign.recruit_end),
      status: campaign.status,
    });
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
      const payload = {
        productId: form.productId,
        title: form.title,
        description: form.description,
        content: buildCampaignContentHtml(form.contentText, form.contentImages),
        campaignType: form.campaignType,
        price: form.price,
        quota: form.quota,
        status: form.status,
        recruitStart: new Date(form.recruitStart).toISOString(),
        recruitEnd: new Date(form.recruitEnd).toISOString(),
      };
      const res = await fetch(
        editingCampaign ? `/api/admin/trials/${editingCampaign.id}` : "/api/admin/trials",
        {
          method: editingCampaign ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchCampaigns();
        alert(editingCampaign ? "✅ 체험단이 수정되었습니다." : "✅ 체험단이 개설되었습니다.");
      } else {
        alert(result.error ?? "저장에 실패했습니다.");
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
                        <button onClick={() => openEdit(c)} className="admin-btn admin-btn-secondary admin-btn-sm">
                          ✏️ 수정
                        </button>
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
              <h2 className="admin-modal-title">{editingCampaign ? "✏️ 체험단 수정" : "＋ 체험단 개설"}</h2>
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
                  <label className="admin-label">한 줄 소개</label>
                  <textarea className="admin-textarea" value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} placeholder="목록 카드에 짧게 보여줄 소개 문구" />
                </div>

                <div className="admin-field" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem" }}>
                  <label className="admin-label" style={{ fontWeight: 700, color: "#374151" }}>📄 상세페이지 내용 (지원 조건 · 진행 방식 등)</label>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.15rem 0 0.6rem" }}>
                    체험단 상세페이지 본문에 노출됩니다. 글과 사진을 함께 올릴 수 있어요.
                  </p>
                  <textarea
                    className="admin-textarea"
                    value={form.contentText}
                    onChange={(e) => setF("contentText", e.target.value)}
                    rows={5}
                    placeholder="지원 조건, 선정 기준, 진행 방식, 유의사항 등을 자유롭게 작성해주세요."
                    style={{ marginBottom: "0.75rem" }}
                  />
                  <MultiImageUploader
                    images={form.contentImages}
                    onChange={(contentImages) => setF("contentImages", contentImages)}
                    hint="상세페이지 하단에 순서대로 이어붙여 표시됩니다."
                  />
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
                    <option value="recruiting">모집중 (공개)</option>
                    <option value="selecting">선정중 (공개)</option>
                    <option value="closed">종료 (공개, 신청 불가)</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? "저장 중..." : editingCampaign ? "수정 완료" : "체험단 개설"}
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

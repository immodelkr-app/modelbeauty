"use client";

import { useState, useEffect, useCallback } from "react";
import MultiImageUploader, { type UploadedImage } from "@/components/admin/MultiImageUploader";

interface Campaign {
  id: string;
  product_id: string | null;
  title: string;
  description: string | null;
  content: string | null;
  thumbnail: string | null;
  campaign_type: "free" | "paid";
  price: number;
  quota: number;
  recruit_start: string;
  recruit_end: string;
  status: "draft" | "recruiting" | "selecting" | "closed";
  applicant_count: number;
  created_at: string;
  friendtalk_sent_at: string | null;
  products: { name: string; slug: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
}

interface Applicant {
  id: string;
  master_user_id: string;
  applicant_name: string | null;
  applicant_phone: string | null;
  address_zipcode: string | null;
  address_main: string | null;
  address_detail: string | null;
  youtube_channel: string | null;
  instagram_id: string | null;
  channel_url: string | null;
  message: string | null;
  consent_image_usage: boolean | null;
  status: "applied" | "selected" | "rejected";
  applied_at: string;
  notified_at: string | null;
  has_review: boolean;
  review_reminded_at: string | null;
}

const APPLICANT_STATUS_LABEL: Record<Applicant["status"], string> = {
  applied: "심사중",
  selected: "선정됨",
  rejected: "반려됨",
};
const APPLICANT_STATUS_COLOR: Record<Applicant["status"], { bg: string; fg: string }> = {
  applied: { bg: "#f3f4f6", fg: "#6b7280" },
  selected: { bg: "#dcfce7", fg: "#15803d" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c" },
};

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
  thumbnailImage: [] as UploadedImage[],
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
  const [sendingFriendTalkId, setSendingFriendTalkId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

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
      productId: campaign.product_id ?? "",
      title: campaign.title,
      description: campaign.description ?? "",
      thumbnailImage: campaign.thumbnail ? [{ url: campaign.thumbnail, alt: "" }] : [],
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
    if (!form.title.trim()) { alert("제목은 필수입니다."); return; }
    if (!form.recruitStart || !form.recruitEnd) { alert("모집 기간을 입력해주세요."); return; }

    setSubmitting(true);
    try {
      const payload = {
        productId: form.productId || null,
        title: form.title,
        description: form.description,
        thumbnail: form.thumbnailImage[0]?.url || null,
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

  const loadApplicants = async (campaignId: string) => {
    setApplicantsLoading(true);
    try {
      const res = await fetch(`/api/admin/trials/${campaignId}/applicants`);
      const result = await res.json();
      if (result.success) setApplicants(result.data ?? []);
      else alert(result.error ?? "신청자 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setApplicantsLoading(false);
    }
  };

  const openApplicants = async (campaign: Campaign) => {
    setApplicantsFor(campaign);
    await loadApplicants(campaign.id);
  };

  const handleSendNotify = async (campaign: Campaign) => {
    const already = campaign.friendtalk_sent_at
      ? `\n(이전 발송: ${new Date(campaign.friendtalk_sent_at).toLocaleString("ko-KR")})`
      : "";
    if (
      !confirm(
        `"${campaign.title}" 체험단 모집 안내를 전체 회원에게 카카오 친구톡("아임모델" 채널) + 앱푸시로 발송하시겠습니까?${already}`
      )
    ) return;

    setSendingFriendTalkId(campaign.id);
    try {
      const res = await fetch(`/api/admin/trials/${campaign.id}/notify`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        const ft = result.friendtalk;
        const push = result.push;
        alert(
          `✅ 발송 완료\n\n💬 친구톡: 대상 ${ft.attempted}명 · 성공 ${ft.succeeded}명 · 실패 ${ft.failed}명${ft.error ? `\n   ⚠️ ${ft.error}` : ""}` +
          `\n\n📱 앱푸시: 대상 ${push.targetCount}명 · 성공 ${push.successCount}명 · 실패 ${push.failureCount}명${push.error ? `\n   ⚠️ ${push.error}` : ""}`
        );
        fetchCampaigns();
      } else {
        alert(result.error ?? "발송에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSendingFriendTalkId(null);
    }
  };

  const handleApplicantDecision = async (applicant: Applicant, status: "selected" | "rejected") => {
    if (!applicantsFor) return;
    if (
      status === "selected" &&
      !confirm("선정 처리하시겠습니까? 즉시 앱푸시 + 문자로 선정 안내가 자동 발송됩니다.")
    ) return;
    if (status === "rejected" && !confirm("반려 처리하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/trials/${applicantsFor.id}/applicants/${applicant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (result.success) {
        if (status === "selected") {
          const pushMsg = { sent: "발송됨", no_token: "앱 미설치/로그아웃", failed: "발송 실패", skipped: "-" }[result.pushResult as string] ?? result.pushResult;
          const smsMsg = { sent: "발송됨", no_phone: "연락처 없음", failed: "발송 실패", skipped: "-" }[result.smsResult as string] ?? result.smsResult;
          alert(`✅ 선정 처리 완료\n앱푸시: ${pushMsg}\n문자: ${smsMsg}`);
        } else {
          alert("반려 처리되었습니다.");
        }
        loadApplicants(applicantsFor.id);
        fetchCampaigns();
      } else {
        alert(result.error ?? "처리에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleRemindReview = async (applicant: Applicant) => {
    if (!applicantsFor) return;
    const already = applicant.review_reminded_at
      ? `\n(이전 발송: ${new Date(applicant.review_reminded_at).toLocaleString("ko-KR")})`
      : "";
    if (!confirm(`"${applicant.applicant_name ?? "이 신청자"}"에게 후기 작성 리마인드(앱푸시+문자)를 보내시겠습니까?${already}`)) return;

    setSendingReminderId(applicant.id);
    try {
      const res = await fetch(`/api/admin/trials/${applicantsFor.id}/applicants/${applicant.id}/remind-review`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.success) {
        const pushMsg = { sent: "발송됨", no_token: "앱 미설치/로그아웃", failed: "발송 실패", skipped: "-" }[result.pushResult as string] ?? result.pushResult;
        const smsMsg = { sent: "발송됨", no_phone: "연락처 없음", failed: "발송 실패", skipped: "-" }[result.smsResult as string] ?? result.smsResult;
        alert(`✅ 리마인드 발송 완료\n앱푸시: ${pushMsg}\n문자: ${smsMsg}`);
        loadApplicants(applicantsFor.id);
      } else {
        alert(result.error ?? "발송에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSendingReminderId(null);
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
                          onClick={() => handleSendNotify(c)}
                          disabled={sendingFriendTalkId === c.id}
                          className="admin-btn admin-btn-sm"
                          style={{ borderColor: "#f2b100", color: "#8a5a00", backgroundColor: "#fff8e1", fontSize: "0.72rem" }}
                          title={c.friendtalk_sent_at ? `이전 발송: ${new Date(c.friendtalk_sent_at).toLocaleString("ko-KR")}` : "카카오 친구톡 + 앱푸시로 모집 안내 발송"}
                        >
                          {sendingFriendTalkId === c.id ? "발송 중..." : c.friendtalk_sent_at ? "💬📱 재발송" : "💬📱 친구톡+푸시"}
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
          <div className="admin-modal-container" style={{ maxWidth: 860, width: "100%" }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editingCampaign ? "✏️ 체험단 수정" : "＋ 체험단 개설"}</h2>
              <button onClick={() => setShowModal(false)} className="admin-modal-close-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", flex: 1, overflowY: "auto" }}>
                <div className="admin-field">
                  <label className="admin-label">상품 연결 (선택)</label>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.15rem 0 0.6rem" }}>
                    상품이 아직 등록되기 전이어도 체험단을 먼저 개설할 수 있습니다. 나중에 상품이 등록되면 수정 화면에서 연결해주세요.
                  </p>
                  <select className="admin-input" value={form.productId} onChange={(e) => setF("productId", e.target.value)}>
                    <option value="">연결 안 함</option>
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

                <div className="admin-field">
                  <label className="admin-label">썸네일(포스터) 이미지</label>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.15rem 0 0.6rem" }}>
                    목록 카드와 상세페이지 상단에 정사각형(1:1)으로 노출됩니다. 비워두면 연결된 상품 이미지가 대신 사용됩니다.
                  </p>
                  <MultiImageUploader
                    images={form.thumbnailImage}
                    onChange={(imgs) => setF("thumbnailImage", imgs.slice(-1))}
                    hint="1장만 사용됩니다. jpg/png/webp/gif, 5MB 이하."
                  />
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

                <div
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    fontSize: "0.8rem", color: "#6b7280",
                    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "0.6rem 0.9rem",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--mb-pink-600, #db2777)" }}>무료 체험단</span>
                  참가비 결제 연동 전까지는 무료 체험단만 운영합니다.
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
          <div className="admin-modal-container" style={{ maxWidth: 1240, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{applicantsFor.title} — 신청자 목록</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {applicants.length > 0 && (
                  <button
                    onClick={() => { window.location.href = `/api/admin/trials/${applicantsFor.id}/applicants/excel-download`; }}
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                  >
                    📊 엑셀 다운로드
                  </button>
                )}
                <button onClick={() => setApplicantsFor(null)} className="admin-modal-close-btn">✕</button>
              </div>
            </div>
            <div className="admin-modal-body" style={{ overflowY: "auto" }}>
              {applicantsLoading ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
              ) : applicants.length === 0 ? (
                <div className="admin-empty">
                  <p className="admin-empty-title">아직 신청자가 없습니다</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                <table className="admin-table" style={{ tableLayout: "fixed", width: "100%", minWidth: "980px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "7%" }}>이름</th>
                      <th style={{ width: "10%" }}>연락처</th>
                      <th style={{ width: "20%" }}>배송지</th>
                      <th style={{ width: "13%" }}>SNS</th>
                      <th style={{ width: "16%" }}>활동소개</th>
                      <th style={{ width: "10%" }}>신청일</th>
                      <th style={{ width: "6%" }}>상태</th>
                      <th style={{ width: "10%" }}>후기</th>
                      <th style={{ width: "8%" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {a.applicant_name ?? "—"}
                          <span
                            title={a.consent_image_usage ? "초상권·콘텐츠 사용 동의함" : "초상권·콘텐츠 사용 동의 미확인"}
                            style={{ marginLeft: "4px" }}
                          >
                            {a.consent_image_usage ? "✅" : "⚠️"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{a.applicant_phone ?? "—"}</td>
                        <td style={{ fontSize: "0.78rem", color: "#374151", wordBreak: "keep-all" }}>
                          {a.address_main
                            ? `[${a.address_zipcode ?? ""}] ${a.address_main}${a.address_detail ? ` ${a.address_detail}` : ""}`
                            : "—"}
                        </td>
                        <td style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
                          {a.youtube_channel && <div>🎥 {a.youtube_channel}</div>}
                          {a.instagram_id && <div>📸 {a.instagram_id}</div>}
                          {a.channel_url && (
                            <a href={a.channel_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                              🔗 {a.channel_url}
                            </a>
                          )}
                          {!a.youtube_channel && !a.instagram_id && !a.channel_url && "—"}
                        </td>
                        <td style={{ fontSize: "0.8rem", wordBreak: "keep-all" }}>{a.message ?? "—"}</td>
                        <td style={{ fontSize: "0.75rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {new Date(a.applied_at).toLocaleString("ko-KR")}
                        </td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                            fontSize: "0.72rem", fontWeight: 700,
                            background: APPLICANT_STATUS_COLOR[a.status].bg, color: APPLICANT_STATUS_COLOR[a.status].fg,
                          }}>
                            {APPLICANT_STATUS_LABEL[a.status]}
                          </span>
                          {a.notified_at && (
                            <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: "2px" }}>
                              알림 {new Date(a.notified_at).toLocaleDateString("ko-KR")}
                            </div>
                          )}
                        </td>
                        <td>
                          {a.status !== "selected" ? (
                            <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>—</span>
                          ) : a.has_review ? (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803d" }}>✅ 작성완료</span>
                          ) : (
                            <div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#b91c1c" }}>❌ 미작성</span>
                              <button
                                onClick={() => handleRemindReview(a)}
                                disabled={sendingReminderId === a.id}
                                className="admin-btn admin-btn-sm"
                                style={{ display: "block", marginTop: "3px", borderColor: "#f2b100", color: "#8a5a00", backgroundColor: "#fff8e1", fontSize: "0.68rem", padding: "2px 6px" }}
                              >
                                {sendingReminderId === a.id ? "발송 중..." : "🔔 리마인드"}
                              </button>
                              {a.review_reminded_at && (
                                <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: "2px" }}>
                                  {new Date(a.review_reminded_at).toLocaleDateString("ko-KR")} 발송
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {a.status === "applied" ? (
                            <div style={{ display: "flex", gap: "0.3rem" }}>
                              <button
                                onClick={() => handleApplicantDecision(a, "selected")}
                                className="admin-btn admin-btn-sm"
                                style={{ borderColor: "#15803d", color: "#15803d", backgroundColor: "#f0fdf4", fontSize: "0.72rem" }}
                              >
                                선정
                              </button>
                              <button
                                onClick={() => handleApplicantDecision(a, "rejected")}
                                className="admin-btn admin-btn-sm"
                                style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "#fef2f2", fontSize: "0.72rem" }}
                              >
                                반려
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              {applicants.length > 0 && (
                <p style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "1rem" }}>
                  참가비 결제 연동은 다음 단계에서 추가될 예정입니다. 지금은 선정 알림(앱푸시/문자)만 자동 발송됩니다.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

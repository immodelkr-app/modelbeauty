"use client";

import { useState, useEffect, useCallback } from "react";

const CATEGORY_LABEL: Record<string, string> = {
  product: "제품문의",
  trial: "체험단문의",
  app: "앱사용문의",
  etc: "기타문의",
};

interface Inquiry {
  id: string;
  masterUserId: string;
  category: string;
  title: string;
  body: string;
  images: { url: string }[];
  isPrivate: boolean;
  status: "pending" | "answered";
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  product: { id: string; name: string; slug: string } | null;
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [answering, setAnswering] = useState<Inquiry | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchInquiries = useCallback(async (category: string, status: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/inquiries${params.toString() ? `?${params}` : ""}`);
      const result = await res.json();
      if (result.success) setInquiries(result.data ?? []);
      else alert(result.error ?? "문의 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInquiries(categoryFilter, statusFilter); }, [categoryFilter, statusFilter, fetchInquiries]);

  const openAnswer = (inquiry: Inquiry) => {
    setAnswering(inquiry);
    setAnswerText(inquiry.answer ?? "");
  };

  const handleSaveAnswer = async () => {
    if (!answering || !answerText.trim()) {
      alert("답변 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${answering.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        setAnswering(null);
        fetchInquiries(categoryFilter, statusFilter);
      } else {
        alert(result.error ?? "답변 등록에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inquiry: Inquiry) => {
    if (!confirm("이 문의를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) fetchInquiries(categoryFilter, statusFilter);
      else alert(result.error ?? "삭제에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const pendingCount = inquiries.filter((i) => i.status === "pending").length;

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          1:1 문의 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({inquiries.length}건{pendingCount > 0 ? ` · 답변대기 ${pendingCount}건` : ""})
          </span>
        </h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["all", "product", "trial", "app", "etc"].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`admin-btn admin-btn-sm${categoryFilter === c ? " admin-btn-primary" : " admin-btn-secondary"}`}
            >
              {c === "all" ? "전체 유형" : CATEGORY_LABEL[c]}
            </button>
          ))}
          <span style={{ width: 1, background: "#e5e7eb", margin: "0 0.25rem" }} />
          {[
            { v: "all", l: "전체 상태" },
            { v: "pending", l: "답변대기" },
            { v: "answered", l: "답변완료" },
          ].map((s) => (
            <button
              key={s.v}
              onClick={() => setStatusFilter(s.v)}
              className={`admin-btn admin-btn-sm${statusFilter === s.v ? " admin-btn-primary" : " admin-btn-secondary"}`}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">💬</div>
              <p className="admin-empty-title">등록된 문의가 없습니다</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>유형</th>
                  <th>제목</th>
                  <th>관련 상품</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontSize: "0.78rem", fontWeight: 700 }}>{CATEGORY_LABEL[i.category] ?? i.category}</td>
                    <td style={{ maxWidth: 220, fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i.title}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {i.product?.name ?? "—"}
                    </td>
                    <td className="admin-text-mono" style={{ fontSize: "0.72rem" }}>{i.masterUserId.slice(0, 8)}…</td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{new Date(i.createdAt).toLocaleDateString("ko-KR")}</td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                        fontSize: "0.75rem", fontWeight: 700,
                        background: i.status === "answered" ? "#dcfce7" : "#fef3c7",
                        color: i.status === "answered" ? "#15803d" : "#b45309",
                      }}>
                        {i.status === "answered" ? "답변완료" : "답변대기"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button onClick={() => openAnswer(i)} className="admin-btn admin-btn-secondary admin-btn-sm">
                          {i.status === "answered" ? "답변 수정" : "💬 답변하기"}
                        </button>
                        <button
                          onClick={() => handleDelete(i)}
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

      {/* 답변 모달 */}
      {answering && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container" style={{ maxWidth: 560 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">💬 문의 답변</h2>
              <button onClick={() => setAnswering(null)} className="admin-modal-close-btn">✕</button>
            </div>
            <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "0.9rem 1rem" }}>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.78rem", fontWeight: 700, color: "#9ca3af" }}>
                  {CATEGORY_LABEL[answering.category] ?? answering.category}
                  {answering.product ? ` · ${answering.product.name}` : ""}
                </p>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 700 }}>{answering.title}</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151", whiteSpace: "pre-wrap" }}>{answering.body}</p>
                {answering.images.length > 0 && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    {answering.images.map((img, idx) => (
                      <img key={idx} src={img.url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-field">
                <label className="admin-label admin-label-required">답변 내용</label>
                <textarea
                  className="admin-textarea"
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="문의에 대한 답변을 입력해주세요."
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setAnswering(null)}>
                취소
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleSaveAnswer} disabled={saving}>
                {saving ? "저장 중..." : "답변 등록"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

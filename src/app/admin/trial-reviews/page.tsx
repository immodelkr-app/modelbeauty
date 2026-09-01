"use client";

import { useState, useEffect, useCallback } from "react";

interface TrialReviewRow {
  id: string;
  campaign_id: string;
  master_user_id: string;
  title: string;
  body: string;
  images: { url: string }[];
  external_link: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  points_granted: number;
  points_granted_at: string | null;
  created_at: string;
  trial_campaigns: { title: string; products: { name: string; slug: string } | null } | null;
}

export default function AdminTrialReviewsPage() {
  const [reviews, setReviews] = useState<TrialReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hidden">("all");

  const fetchReviews = useCallback(async (f: "all" | "hidden") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trial-reviews${f === "hidden" ? "?hidden=true" : ""}`);
      const result = await res.json();
      if (result.success) setReviews(result.data ?? []);
      else alert(result.error ?? "체험 후기 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(filter); }, [filter, fetchReviews]);

  const handleToggleHidden = async (review: TrialReviewRow) => {
    const willHide = !review.is_hidden;
    const reason = willHide ? prompt("숨김 사유를 입력해주세요 (선택)") ?? "" : "";
    try {
      const res = await fetch(`/api/admin/trial-reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: willHide, hiddenReason: reason }),
      });
      const result = await res.json();
      if (result.success) fetchReviews(filter);
      else alert(result.error ?? "처리에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleGrantPoints = async (review: TrialReviewRow) => {
    const input = prompt(
      review.points_granted > 0
        ? `추가로 지급할 포인트를 입력하세요. (지금까지 ${review.points_granted.toLocaleString()}P 지급됨)`
        : "지급할 포인트를 입력하세요."
    );
    if (!input) return;
    const amount = parseInt(input, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      alert("1 이상의 숫자를 입력해주세요.");
      return;
    }
    const description = prompt("지급 사유(선택)") ?? "";
    try {
      const res = await fetch(`/api/admin/trial-reviews/${review.id}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`✅ ${amount.toLocaleString()}P 지급 완료 (잔액 ${result.newBalance?.toLocaleString() ?? "-"}P)`);
        fetchReviews(filter);
      } else {
        alert(result.error ?? "포인트 지급에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (review: TrialReviewRow) => {
    if (!confirm("이 체험 후기를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      const res = await fetch(`/api/admin/trial-reviews/${review.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) fetchReviews(filter);
      else alert(result.error ?? "삭제에 실패했습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          체험 후기 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({reviews.length}건 · 메인페이지 노출)
          </span>
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setFilter("all")}
            className={`admin-btn admin-btn-sm${filter === "all" ? " admin-btn-primary" : " admin-btn-secondary"}`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter("hidden")}
            className={`admin-btn admin-btn-sm${filter === "hidden" ? " admin-btn-primary" : " admin-btn-secondary"}`}
          >
            숨김만
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : reviews.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">📝</div>
              <p className="admin-empty-title">
                {filter === "hidden" ? "숨김 처리된 체험 후기가 없습니다" : "등록된 체험 후기가 없습니다"}
              </p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>체험단</th>
                  <th>상품</th>
                  <th>제목</th>
                  <th>사진</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>상태</th>
                  <th>포인트</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: "0.8rem", maxWidth: 140 }}>{r.trial_campaigns?.title ?? "—"}</td>
                    <td style={{ fontSize: "0.8rem", maxWidth: 120 }}>{r.trial_campaigns?.products?.name ?? "—"}</td>
                    <td style={{ fontWeight: 600, maxWidth: 200 }}>
                      <a href={`/trial-reviews/${r.id}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                        {r.title}
                      </a>
                    </td>
                    <td>{r.images?.length ? `📷 ${r.images.length}` : "—"}</td>
                    <td className="admin-text-mono" style={{ fontSize: "0.72rem" }}>
                      {r.master_user_id.slice(0, 8)}…
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 9999,
                        fontSize: "0.75rem", fontWeight: 700,
                        background: r.is_hidden ? "#f3f4f6" : "#dcfce7",
                        color: r.is_hidden ? "#6b7280" : "#15803d",
                      }}>
                        {r.is_hidden ? "숨김" : "노출중"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", fontWeight: r.points_granted > 0 ? 700 : 400, color: r.points_granted > 0 ? "#15803d" : "#9ca3af" }}>
                      {r.points_granted > 0 ? `${r.points_granted.toLocaleString()}P` : "미지급"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          onClick={() => handleGrantPoints(r)}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          style={{ borderColor: "#15803d", color: "#15803d" }}
                        >
                          💰 포인트 지급
                        </button>
                        <button
                          onClick={() => handleToggleHidden(r)}
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                        >
                          {r.is_hidden ? "노출 전환" : "숨기기"}
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
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
    </>
  );
}

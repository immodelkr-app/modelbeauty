"use client";

import { useState, useEffect, useCallback } from "react";

interface Review {
  id: string;
  product_id: string;
  master_user_id: string;
  order_id: string;
  rating: number;
  body: string;
  images: { url: string }[];
  external_link: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
  products: { name: string; slug: string } | null;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hidden">("all");

  const fetchReviews = useCallback(async (f: "all" | "hidden") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews${f === "hidden" ? "?hidden=true" : ""}`);
      const result = await res.json();
      if (result.success) setReviews(result.data ?? []);
      else alert(result.error ?? "리뷰 목록을 불러올 수 없습니다.");
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(filter); }, [filter, fetchReviews]);

  const handleToggleHidden = async (review: Review) => {
    const willHide = !review.is_hidden;
    const reason = willHide ? prompt("숨김 사유를 입력해주세요 (선택)") ?? "" : "";
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
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

  const handleDelete = async (review: Review) => {
    if (!confirm("이 리뷰를 완전히 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
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
          리뷰 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({reviews.length}건)
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
                {filter === "hidden" ? "숨김 처리된 리뷰가 없습니다" : "등록된 리뷰가 없습니다"}
              </p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>상품</th>
                  <th>별점</th>
                  <th>내용</th>
                  <th>사진</th>
                  <th>SNS 링크</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, maxWidth: 140 }}>{r.products?.name ?? "—"}</td>
                    <td style={{ color: "#f59e0b", fontWeight: 700 }}>{"★".repeat(r.rating)}</td>
                    <td style={{ maxWidth: 280, fontSize: "0.82rem", color: "#374151" }}>
                      {r.body.length > 60 ? `${r.body.slice(0, 60)}…` : r.body}
                    </td>
                    <td>{r.images?.length ? `📷 ${r.images.length}` : "—"}</td>
                    <td>
                      {r.external_link ? (
                        <a href={r.external_link} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: "0.8rem" }}>
                          링크 보기
                        </a>
                      ) : "—"}
                    </td>
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
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
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

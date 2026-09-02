"use client";
// ============================================================
// TrialReviews — 체험단 캠페인 상세페이지의 "체험 후기" 섹션 (Client Component)
// 블로그 형식(제목+본문+사진) 후기 목록 + 작성 폼(선정된 신청자만)
// ============================================================

import { useState, useRef } from "react";
import Link from "next/link";
import type { TrialReview } from "@/types";
import { StarRatingDisplay, StarRatingInput } from "./StarRating";

interface TrialReviewsProps {
  campaignId: string;
  initialReviews: TrialReview[];
  canWrite: boolean; // 선정되었고 아직 후기를 안 쓴 경우만 true
}

export default function TrialReviews({ campaignId, initialReviews, canWrite }: TrialReviewsProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [hasWritten, setHasWritten] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > 10) {
      alert("사진은 최대 10장까지 첨부할 수 있어요.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/reviews/upload", { method: "POST", body: formData });
        const result = await res.json();
        if (result.success) {
          setImages((prev) => [...prev, result.url]);
        } else {
          alert(result.error ?? "사진 업로드에 실패했습니다.");
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }
    if (rating <= 0) {
      alert("총점 별점을 선택해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trials/${campaignId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), rating, images }),
      });
      const result = await res.json();
      if (result.success) {
        alert("체험 후기가 등록되었습니다! 메인페이지에도 노출됩니다.");
        setShowForm(false);
        setHasWritten(true);
        setTitle("");
        setBody("");
        setRating(0);
        setImages([]);
        const listRes = await fetch(`/api/trials/${campaignId}/reviews`);
        const listResult = await listRes.json();
        if (listResult.success) setReviews(listResult.data);
      } else {
        alert(result.error ?? "등록에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const showWriteButton = canWrite && !hasWritten;

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: 0 }}>📝 체험 후기</h2>
        {showWriteButton && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "0.5rem 1rem", border: "none", borderRadius: "999px",
              fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer",
              background: showForm ? "var(--mb-gray-200)" : "var(--mb-pink-600)",
              color: showForm ? "var(--mb-gray-700)" : "#fff",
            }}
          >
            {showForm ? "취소" : "✍️ 후기 작성"}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1px solid var(--mb-gray-200)", borderRadius: "16px", padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "0.9rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>총점</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <StarRatingInput value={rating} onChange={setRating} />
              <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--mb-pink-600)" }}>
                {rating > 0 ? `${rating.toFixed(1)} / 5.0` : "별점을 선택해주세요"}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: "0.9rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>제목</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="예) 2주 써보고 느낀 솔직 후기"
              style={{ width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", padding: "0.65rem 0.75rem", fontSize: "0.9375rem", fontWeight: 600 }}
            />
          </div>

          <div style={{ marginBottom: "0.9rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>내용</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={8}
              placeholder="사용 전후 느낀 점, 제품 특징 등을 블로그처럼 자유롭게 써주세요."
              style={{ width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", padding: "0.75rem", fontSize: "0.9rem", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>
              사진 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(최대 10장)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {images.map((url) => (
                <div key={url} style={{ position: "relative", width: 72, height: 72 }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                  <button
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.65)", color: "#fff", border: "none", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {images.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ width: 72, height: 72, borderRadius: 8, border: "1px dashed var(--mb-gray-300, #d1d5db)", background: "var(--mb-gray-50)", color: "var(--mb-gray-500)", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  {uploading ? "업로드중" : "+ 추가"}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageSelect} style={{ display: "none" }} />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            style={{
              width: "100%", padding: "0.75rem", background: "var(--mb-pink-600)", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "0.9375rem", fontWeight: 700,
              cursor: submitting || uploading ? "default" : "pointer", opacity: submitting || uploading ? 0.6 : 1,
            }}
          >
            {submitting ? "등록 중..." : "후기 등록하기"}
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ textAlign: "center", padding: "2.5rem 0", color: "var(--mb-gray-400)", fontSize: "0.875rem" }}>
          아직 등록된 체험 후기가 없어요.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {reviews.map((r) => {
            const thumb = r.images?.[0]?.url;
            return (
              <Link
                key={r.id}
                href={`/trial-reviews/${r.id}`}
                style={{ border: "1px solid var(--mb-gray-200)", borderRadius: "14px", overflow: "hidden", textDecoration: "none", color: "inherit", background: "#fff" }}
              >
                <div style={{ position: "relative", aspectRatio: "4/3", background: "var(--mb-gray-50)" }}>
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.5rem" }}>📷</div>
                  )}
                </div>
                <div style={{ padding: "0.75rem" }}>
                  <div style={{ marginBottom: "0.3rem" }}>
                    <StarRatingDisplay rating={r.rating} size={13} />
                  </div>
                  <h3 style={{ margin: "0 0 0.3rem", fontSize: "0.875rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--mb-gray-500)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.body}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";
// ============================================================
// ProductReviews — 상품 상세 "리뷰" 탭 (Client Component)
// 평점 요약 + 리뷰 목록(더보기) + 리뷰 작성 폼(구매 확정 회원만 서버에서 검증)
// ============================================================

import { useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import type { ProductReview, ProductReviewSummary } from "@/types";

interface ProductReviewsProps {
  productSlug: string;
  initialReviews: ProductReview[];
  initialSummary: ProductReviewSummary;
  initialNextCursor: string | null;
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }} aria-label={`별점 ${value}점`}>
      {"★".repeat(Math.round(value))}
      <span style={{ color: "var(--mb-gray-200, #e5e7eb)" }}>{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export default function ProductReviews({
  productSlug,
  initialReviews,
  initialSummary,
  initialNextCursor,
}: ProductReviewsProps) {
  const { isLoggedIn } = useAuthStore();
  const [reviews, setReviews] = useState(initialReviews);
  const [summary, setSummary] = useState(initialSummary);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/products/${productSlug}/reviews?cursor=${encodeURIComponent(nextCursor)}`);
      const result = await res.json();
      if (result.success) {
        setReviews((prev) => [...prev, ...result.data.reviews]);
        setNextCursor(result.data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, productSlug]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (images.length + files.length > 5) {
      alert("사진은 최대 5장까지 첨부할 수 있어요.");
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
    if (!text.trim()) {
      alert("리뷰 내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productSlug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          body: text.trim(),
          images,
          externalLink: externalLink.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert("리뷰가 등록되었습니다. 감사합니다!");
        setShowForm(false);
        setText("");
        setExternalLink("");
        setImages([]);
        setRating(5);
        // 새로 쓴 리뷰가 맨 위에 보이도록 목록/요약 다시 불러오기
        const listRes = await fetch(`/api/products/${productSlug}/reviews`);
        const listResult = await listRes.json();
        if (listResult.success) {
          setReviews(listResult.data.reviews);
          setSummary(listResult.data.summary);
          setNextCursor(listResult.data.nextCursor);
        }
      } else {
        alert(result.error ?? "리뷰 등록에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* 요약 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          padding: "1.25rem",
          background: "var(--mb-gray-50)",
          borderRadius: "16px",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--mb-gray-900)" }}>
            {summary.average.toFixed(1)}
          </span>
          <div>
            <Stars value={summary.average} size={16} />
            <div style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", marginTop: "2px" }}>
              후기 {summary.count.toLocaleString()}개
            </div>
          </div>
        </div>

        {isLoggedIn && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "0.625rem 1.25rem",
              background: showForm ? "var(--mb-gray-200)" : "var(--mb-pink-600)",
              color: showForm ? "var(--mb-gray-700)" : "#fff",
              border: "none",
              borderRadius: "999px",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {showForm ? "취소" : "✍️ 리뷰 작성"}
          </button>
        )}
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <div
          style={{
            border: "1px solid var(--mb-gray-200)",
            borderRadius: "16px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", margin: "0 0 1rem" }}>
            구매 후 배송이 완료된 상품만 리뷰를 작성할 수 있어요.
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>별점</div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  aria-label={`${n}점`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.5rem",
                    color: n <= rating ? "#f59e0b" : "var(--mb-gray-200, #e5e7eb)",
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>후기 내용</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="제품 사용 후기를 남겨주세요."
              style={{
                width: "100%",
                border: "1px solid var(--mb-gray-200)",
                borderRadius: "10px",
                padding: "0.75rem",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>
              사진 첨부 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택, 최대 5장)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {images.map((url) => (
                <div key={url} style={{ position: "relative", width: 64, height: 64 }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                  <button
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    aria-label="사진 삭제"
                    style={{
                      position: "absolute", top: -6, right: -6,
                      width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(0,0,0,0.65)", color: "#fff", border: "none",
                      fontSize: "0.7rem", cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    width: 64, height: 64, borderRadius: 8,
                    border: "1px dashed var(--mb-gray-300, #d1d5db)",
                    background: "var(--mb-gray-50)",
                    color: "var(--mb-gray-500)",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  {uploading ? "업로드중" : "+ 추가"}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>
              블로그·유튜브·인스타 링크 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택 — 첨부 시 포인트 추가 적립)</span>
            </div>
            <input
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://..."
              style={{
                width: "100%",
                border: "1px solid var(--mb-gray-200)",
                borderRadius: "10px",
                padding: "0.65rem 0.75rem",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "var(--mb-pink-600)",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "0.9375rem",
              fontWeight: 700,
              cursor: submitting || uploading ? "default" : "pointer",
              opacity: submitting || uploading ? 0.6 : 1,
            }}
          >
            {submitting ? "등록 중..." : "리뷰 등록하기"}
          </button>
        </div>
      )}

      {/* 목록 */}
      {reviews.length === 0 ? (
        <p style={{ textAlign: "center", padding: "3rem 0", color: "var(--mb-gray-400)" }}>
          아직 작성된 리뷰가 없습니다. 첫 리뷰를 남겨보세요!
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--mb-gray-100, #f3f4f6)", paddingBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <Stars value={r.rating} />
                <span style={{ fontSize: "0.75rem", color: "var(--mb-gray-400)" }}>
                  {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--mb-gray-800, #1f2937)", lineHeight: 1.6, margin: "0 0 0.6rem", whiteSpace: "pre-wrap" }}>
                {r.body}
              </p>
              {r.images.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                  {r.images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                  ))}
                </div>
              )}
              {r.externalLink && (
                <a
                  href={r.externalLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.78rem", color: "var(--mb-pink-600)", fontWeight: 600 }}
                >
                  🔗 작성자의 SNS 포스팅 보기
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          style={{
            display: "block",
            width: "100%",
            marginTop: "1.5rem",
            padding: "0.75rem",
            background: "#fff",
            border: "1px solid var(--mb-gray-200)",
            borderRadius: "10px",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--mb-gray-700)",
            cursor: "pointer",
          }}
        >
          {loadingMore ? "불러오는 중..." : "리뷰 더보기"}
        </button>
      )}
    </div>
  );
}

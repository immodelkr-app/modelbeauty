"use client";

// ============================================================
// /mypage/inquiries/[id] — 내 문의 상세 (질문 + 관리자 답변)
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";

const CATEGORY_LABEL: Record<string, string> = {
  product: "제품문의",
  trial: "체험단문의",
  app: "앱사용문의",
  etc: "기타문의",
};

interface InquiryDetail {
  id: string;
  category: string;
  title: string;
  body: string;
  images: { url: string }[];
  status: "pending" | "answered";
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  product: { id: string; name: string; slug: string } | null;
}

export default function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/inquiries/${id}`)
        .then((r) => r.json())
        .then((result) => {
          if (result.success) setInquiry(result.data);
          else setNotFound(true);
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--mb-gray-400)" }}>불러오는 중...</div>;
  }

  if (notFound || !inquiry) {
    return (
      <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <p style={{ color: "var(--mb-gray-500)", marginBottom: "1.5rem" }}>문의를 찾을 수 없습니다.</p>
        <Link href="/mypage/inquiries" className="hero-cta-primary">목록으로</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/mypage/inquiries" style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", textDecoration: "none" }}>
        ← 문의 목록
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "1.25rem 0 0.6rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 800, padding: "0.15rem 0.55rem", borderRadius: "999px", background: "var(--mb-gray-100)", color: "var(--mb-gray-600)" }}>
          {CATEGORY_LABEL[inquiry.category] ?? inquiry.category}
        </span>
        <span
          style={{
            fontSize: "0.6875rem", fontWeight: 800, padding: "0.15rem 0.55rem", borderRadius: "999px",
            background: inquiry.status === "answered" ? "#dcfce7" : "#fef3c7",
            color: inquiry.status === "answered" ? "#15803d" : "#b45309",
          }}
        >
          {inquiry.status === "answered" ? "답변완료" : "답변대기"}
        </span>
      </div>

      <h1 style={{ fontSize: "1.375rem", fontWeight: 800, margin: "0 0 0.4rem", color: "var(--mb-gray-900)" }}>
        {inquiry.title}
      </h1>
      <p style={{ margin: "0 0 1.5rem", fontSize: "0.8125rem", color: "var(--mb-gray-400)" }}>
        {inquiry.product ? (
          <>
            <Link href={`/products/${inquiry.product.slug}`} style={{ color: "var(--mb-pink-600)", fontWeight: 600 }}>
              {inquiry.product.name}
            </Link>
            {" · "}
          </>
        ) : null}
        {new Date(inquiry.createdAt).toLocaleString("ko-KR")}
      </p>

      {/* 질문 */}
      <div style={{ background: "#fff", border: "1.5px solid var(--mb-gray-100)", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.25rem" }}>
        <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.75, color: "var(--mb-gray-800, #1f2937)", whiteSpace: "pre-wrap" }}>
          {inquiry.body}
        </p>
        {inquiry.images.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
            {inquiry.images.map((img, i) => (
              <img key={i} src={img.url} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "10px" }} />
            ))}
          </div>
        )}
      </div>

      {/* 답변 */}
      {inquiry.status === "answered" && inquiry.answer ? (
        <div style={{ background: "var(--mb-pink-50)", borderRadius: "16px", padding: "1.5rem" }}>
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.8125rem", fontWeight: 800, color: "var(--mb-pink-600)" }}>
            💬 모델뷰티 답변
            {inquiry.answeredAt && (
              <span style={{ fontWeight: 500, color: "var(--mb-gray-400)", marginLeft: "0.5rem" }}>
                {new Date(inquiry.answeredAt).toLocaleString("ko-KR")}
              </span>
            )}
          </p>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.75, color: "var(--mb-gray-800, #1f2937)", whiteSpace: "pre-wrap" }}>
            {inquiry.answer}
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--mb-gray-400)", fontSize: "0.875rem" }}>
          아직 답변 전이에요. 확인 후 빠르게 답변드릴게요.
        </div>
      )}
    </>
  );
}

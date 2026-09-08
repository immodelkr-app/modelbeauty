"use client";

// ============================================================
// /mypage/inquiries — 내 문의 목록 (제품/체험단/앱사용/기타)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const CATEGORY_TABS = [
  { value: "all", label: "전체" },
  { value: "product", label: "제품문의" },
  { value: "trial", label: "체험단문의" },
  { value: "app", label: "앱사용문의" },
  { value: "etc", label: "기타문의" },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  product: "제품문의",
  trial: "체험단문의",
  app: "앱사용문의",
  etc: "기타문의",
};

interface InquiryListItem {
  id: string;
  category: string;
  title: string;
  status: "pending" | "answered";
  createdAt: string;
  answeredAt: string | null;
  product: { id: string; name: string; slug: string } | null;
}

export default function InquiriesPage() {
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]["value"]>("all");
  const [items, setItems] = useState<InquiryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async (c: string) => {
    setLoading(true);
    try {
      const qs = c === "all" ? "" : `?category=${c}`;
      const res = await fetch(`/api/inquiries${qs}`);
      const result = await res.json();
      if (result.success) setItems(result.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(category); }, [category, fetchItems]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h1 className="mypage-section-title" style={{ margin: 0 }}>1:1 문의</h1>
        <Link
          href="/mypage/inquiries/new"
          style={{
            padding: "0.6rem 1.1rem",
            background: "var(--mb-pink-600)",
            color: "#fff",
            borderRadius: "10px",
            fontSize: "0.875rem",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          문의하기
        </Link>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", marginBottom: "1.5rem", paddingBottom: "0.25rem" }}>
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategory(tab.value)}
            style={{
              flexShrink: 0,
              padding: "0.5rem 1rem",
              borderRadius: "100px",
              border: "1.5px solid",
              borderColor: category === tab.value ? "var(--mb-pink-600)" : "var(--mb-gray-200)",
              background: category === tab.value ? "var(--mb-pink-50)" : "#fff",
              color: category === tab.value ? "var(--mb-pink-600)" : "var(--mb-gray-500)",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--mb-gray-400)" }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>💬</div>
          <p style={{ color: "var(--mb-gray-500)", fontSize: "0.9rem", margin: 0 }}>등록된 문의가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/mypage/inquiries/${item.id}`}
              style={{
                display: "block",
                background: "#fff",
                border: "1.5px solid var(--mb-gray-100)",
                borderRadius: "16px",
                padding: "1.1rem 1.25rem",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 800, padding: "0.15rem 0.55rem",
                    borderRadius: "999px", background: "var(--mb-gray-100)", color: "var(--mb-gray-600)",
                  }}
                >
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 800, padding: "0.15rem 0.55rem", borderRadius: "999px",
                    background: item.status === "answered" ? "#dcfce7" : "#fef3c7",
                    color: item.status === "answered" ? "#15803d" : "#b45309",
                  }}
                >
                  {item.status === "answered" ? "답변완료" : "답변대기"}
                </span>
              </div>
              <p style={{ margin: "0 0 0.3rem", fontSize: "0.9375rem", fontWeight: 700, color: "var(--mb-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--mb-gray-400)" }}>
                {item.product ? `${item.product.name} · ` : ""}
                {new Date(item.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

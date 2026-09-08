"use client";

// ============================================================
// /mypage/inquiries/new — 1:1 문의 작성
// 상품 상세 "상품 문의하기"에서 오면 category=product&productId=...&productName=...로 진입
// ============================================================

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

const CATEGORY_OPTIONS = [
  { value: "product", label: "제품문의" },
  { value: "trial", label: "체험단문의" },
  { value: "app", label: "앱사용문의" },
  { value: "etc", label: "기타문의" },
] as const;

type CategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

function NewInquiryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading } = useAuthStore();

  const initialCategory = (searchParams.get("category") as CategoryValue | null) ?? "etc";
  const productId = searchParams.get("productId");
  const productName = searchParams.get("productName");

  const [category, setCategory] = useState<CategoryValue>(
    CATEGORY_OPTIONS.some((c) => c.value === initialCategory) ? initialCategory : "etc"
  );
  const [title, setTitle] = useState(productName ? `[${productName}] ` : "");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      alert("로그인 후 문의를 작성할 수 있어요.");
      router.replace("/login");
    }
  }, [isLoading, isLoggedIn, router]);

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
    if (!title.trim() || !body.trim()) {
      alert("제목과 문의 내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          productId: category === "product" ? productId ?? undefined : undefined,
          title: title.trim(),
          body: body.trim(),
          images: images.map((url) => ({ url })),
          isPrivate,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert("문의가 접수되었습니다. 답변까지 조금만 기다려주세요.");
        router.push(`/mypage/inquiries/${result.data.id}`);
      } else {
        alert(result.error ?? "문의 등록에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px",
    padding: "0.7rem 0.85rem", fontSize: "0.9375rem", fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" };

  if (isLoading || !isLoggedIn) return null;

  return (
    <>
      <h1 className="mypage-section-title">1:1 문의 작성</h1>

      {productName && (
        <div style={{ background: "var(--mb-pink-50)", borderRadius: "10px", padding: "0.7rem 0.9rem", marginBottom: "1.25rem", fontSize: "0.8125rem", color: "var(--mb-pink-700, #be185d)" }}>
          🛍️ <strong>{productName}</strong> 상품에 대한 문의입니다.
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <div style={labelStyle}>문의 유형</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategory(opt.value)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "100px",
                border: "1.5px solid",
                borderColor: category === opt.value ? "var(--mb-pink-600)" : "var(--mb-gray-200)",
                background: category === opt.value ? "var(--mb-pink-50)" : "#fff",
                color: category === opt.value ? "var(--mb-pink-600)" : "var(--mb-gray-500)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div style={labelStyle}>제목</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="문의 제목을 입력해주세요" style={inputStyle} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div style={labelStyle}>문의 내용</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={8}
          placeholder="문의하실 내용을 자세히 적어주세요."
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--mb-gray-400)", marginTop: "0.25rem" }}>
          {body.length}/2000
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <div style={labelStyle}>사진 첨부 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택, 최대 5장)</span></div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {images.map((url, i) => (
            <div key={url} style={{ position: "relative", width: 72, height: 72, borderRadius: "10px", overflow: "hidden" }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: "50%",
                  border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.7rem", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: 72, height: 72, borderRadius: "10px", border: "1.5px dashed var(--mb-gray-300)",
                background: "var(--mb-gray-50)", color: "var(--mb-gray-400)", fontSize: "1.25rem", cursor: "pointer",
              }}
            >
              {uploading ? "···" : "+"}
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageSelect} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "1.5rem", fontSize: "0.8125rem", color: "var(--mb-gray-600)" }}>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          style={{ width: "16px", height: "16px", accentColor: "var(--mb-pink-600)", cursor: "pointer" }}
        />
        비밀글로 문의하기 (본인과 관리자만 열람 가능)
      </label>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Link
          href="/mypage/inquiries"
          style={{
            flex: 1, textAlign: "center", padding: "0.85rem", border: "1px solid var(--mb-gray-200)",
            borderRadius: "10px", fontSize: "0.9375rem", fontWeight: 700, textDecoration: "none", color: "var(--mb-gray-600)",
          }}
        >
          취소
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting || uploading}
          style={{
            flex: 2, padding: "0.85rem", border: "none", borderRadius: "10px", fontSize: "0.9375rem", fontWeight: 700,
            background: "var(--mb-pink-600)", color: "#fff", cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "접수 중..." : "문의 등록"}
        </button>
      </div>
    </>
  );
}

export default function NewInquiryPage() {
  return (
    <Suspense fallback={null}>
      <NewInquiryContent />
    </Suspense>
  );
}

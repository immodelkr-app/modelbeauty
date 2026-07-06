"use client";

// ============================================================
// ProductForm — 상품 등록/수정 공통 폼 컴포넌트
// ============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Category { id: string; name: string; }
interface Crew { id: string; name: string; nickname: string; }

export interface ProductFormData {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  basePrice: string;
  salePrice: string;
  stockQuantity: string;
  sku: string;
  imageUrl: string;   // 단일 이미지 URL (추후 멀티 업로드로 확장)
  imageAlt: string;
  tags: string;       // 쉼표 구분
  isActive: boolean;
  isFeatured: boolean;
  recommenderCrewId: string;   // 추천 크루 ID (없으면 빈 문자열)
  recommendationNote: string;  // 추천 한마디
}

const INITIAL: ProductFormData = {
  name: "", slug: "", categoryId: "", description: "",
  basePrice: "", salePrice: "", stockQuantity: "0",
  sku: "", imageUrl: "", imageAlt: "", tags: "",
  isActive: true, isFeatured: false,
  recommenderCrewId: "", recommendationNote: "",
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

interface ProductFormProps {
  productId?: string;
  initialData?: Partial<ProductFormData>;
  onSuccess?: (id: string) => void;
}

export default function ProductForm({ productId, initialData, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>({ ...INITIAL, ...initialData });
  const [categories, setCategories] = useState<Category[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!productId;

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(({ data }) => setCategories(data ?? []));
    fetch("/api/admin/crews").then((r) => r.json()).then(({ data }) => setCrews(data ?? []));
  }, []);

  const set = (field: keyof ProductFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleNameChange = (v: string) => {
    set("name", v);
    if (!isEdit) set("slug", toSlug(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const payload = {
      name: form.name,
      slug: form.slug,
      categoryId: form.categoryId || null,
      description: form.description || null,
      basePrice: parseInt(form.basePrice, 10),
      salePrice: form.salePrice ? parseInt(form.salePrice, 10) : null,
      stockQuantity: parseInt(form.stockQuantity, 10) || 0,
      sku: form.sku || null,
      images: form.imageUrl ? [{ url: form.imageUrl, alt: form.imageAlt || form.name, sortOrder: 0 }] : [],
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      recommenderCrewId: form.recommenderCrewId || null,
      recommendationNote: form.recommendationNote || null,
    };

    try {
      const url = isEdit ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "오류가 발생했습니다.");
        setSubmitting(false);
        return;
      }

      const id = result.data?.id ?? productId;
      if (onSuccess) onSuccess(id);
      else router.push("/admin/products");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && (
        <div className="admin-alert admin-alert-warn" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>기본 정보</h2>
        <div className={`admin-form-grid admin-form-grid-2`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          <div className="admin-field" style={{ gridColumn: "1 / -1" }}>
            <label className="admin-label admin-label-required">상품명</label>
            <input className="admin-input" value={form.name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="예) 수분 크림 50ml" />
          </div>
          <div className="admin-field">
            <label className="admin-label admin-label-required">Slug (URL)</label>
            <input className="admin-input" value={form.slug} onChange={(e) => set("slug", e.target.value)} required placeholder="moisture-cream" pattern="[a-z0-9-]+" />
            <p className="admin-input-hint">소문자, 숫자, 하이픈만 허용 · 자동 생성됩니다</p>
          </div>
          <div className="admin-field">
            <label className="admin-label">카테고리</label>
            <select className="admin-select" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">카테고리 없음</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="admin-field" style={{ gridColumn: "1 / -1" }}>
            <label className="admin-label">상품 설명</label>
            <textarea className="admin-textarea" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="상품에 대한 간단한 설명을 입력하세요..." rows={3} />
          </div>
        </div>
      </div>

      {/* 가격 / 재고 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>가격 / 재고</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          <div className="admin-field">
            <label className="admin-label admin-label-required">정가 (원)</label>
            <input type="number" className="admin-input" value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} required min={0} placeholder="30000" />
          </div>
          <div className="admin-field">
            <label className="admin-label">판매가 (원)</label>
            <input type="number" className="admin-input" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} min={0} placeholder="비워두면 할인 없음" />
          </div>
          <div className="admin-field">
            <label className="admin-label">재고 수량</label>
            <input type="number" className="admin-input" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} min={0} />
          </div>
          <div className="admin-field">
            <label className="admin-label">SKU</label>
            <input className="admin-input" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="MB-001" />
          </div>
        </div>
      </div>

      {/* 이미지 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>이미지</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          <div className="admin-field" style={{ gridColumn: "1 / -1" }}>
            <label className="admin-label">이미지 URL</label>
            <input className="admin-input" type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://example.com/image.jpg" />
            <p className="admin-input-hint">외부 이미지 URL을 입력하세요 (추후 직접 업로드 지원 예정)</p>
          </div>
          <div className="admin-field">
            <label className="admin-label">이미지 대체 텍스트</label>
            <input className="admin-input" value={form.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} placeholder="이미지 설명" />
          </div>
          {form.imageUrl && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imageUrl} alt="미리보기" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e5e7eb" }} onError={(e) => (e.currentTarget.style.display = "none")} />
            </div>
          )}
        </div>
      </div>

      {/* 추천 크루 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>🎬 추천 크루 지정</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="admin-field">
            <label className="admin-label">추천 크루</label>
            <select
              className="admin-select"
              value={form.recommenderCrewId}
              onChange={(e) => set("recommenderCrewId", e.target.value)}
            >
              <option value="">추천 크루 없음</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname} ({c.name})
                </option>
              ))}
            </select>
            <p className="admin-input-hint">상품 상세 페이지에 크루 추천 배너가 표시됩니다</p>
          </div>
          {form.recommenderCrewId && (
            <div className="admin-field">
              <label className="admin-label">추천 한마디</label>
              <textarea
                className="admin-textarea"
                value={form.recommendationNote}
                onChange={(e) => set("recommendationNote", e.target.value)}
                placeholder="예) 라이브 방송에서 매번 들고 나오는 필수 템이에요!"
                rows={2}
                maxLength={150}
              />
              <p className="admin-input-hint">{form.recommendationNote.length}/150자</p>
            </div>
          )}
        </div>
      </div>

      {/* 태그 / 설정 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>태그 / 설정</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="admin-field">
            <label className="admin-label">태그</label>
            <input className="admin-input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="수분,크림,민감성피부 (쉼표로 구분)" />
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            <label className="admin-toggle">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
              <span className="admin-toggle-label">판매 활성화</span>
            </label>
            <label className="admin-toggle">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              <span className="admin-toggle-label">베스트 상품으로 표시</span>
            </label>
          </div>
        </div>
      </div>

      {/* 제출 버튼 */}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => router.back()}>
          취소
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
          {submitting ? "저장 중..." : isEdit ? "수정 완료" : "상품 등록"}
        </button>
      </div>
    </form>
  );
}

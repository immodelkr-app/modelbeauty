"use client";

// ============================================================
// ProductForm — 상품 등록/수정 공통 폼 컴포넌트
// ============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MultiImageUploader, { type UploadedImage } from "./MultiImageUploader";
import BlogDetailEditor from "./BlogDetailEditor";

interface Category { id: string; name: string; }
interface Crew { id: string; name: string; nickname: string; }
interface Vendor { id: string; name: string; default_cost_type: string; default_cost_rate: number; default_cost_price: number; }
export interface RelatedProductPick { id: string; name: string; thumbnail: string | null; }

export interface ProductFormData {
  name: string;
  slug: string;
  categoryIds: string[];
  description: string;
  basePrice: string;
  salePrice: string;
  stockQuantity: string;
  sku: string;
  images: UploadedImage[];       // 상품 이미지(첫 번째가 대표 썸네일)
  detailContentType: "images" | "editor"; // 상세페이지 작성 방식
  detailImages: UploadedImage[]; // 상세페이지 이미지(순서대로 쌓아서 content로 저장) — images 모드
  detailEditorHtml: string;      // 블로그 에디터로 작성한 HTML — editor 모드
  tags: string;       // 쉼표 구분
  isActive: boolean;
  isFeatured: boolean;
  recommenderCrewId: string;   // 추천 크루 ID (없으면 빈 문자열)
  recommendationNote: string;  // 추천 한마디
  relatedProducts: RelatedProductPick[]; // 연관상품 (순서대로)
  vendorId: string;
  vendorCostType: string;
  vendorCostRate: string;
  vendorSupplyPrice: string;
}

const INITIAL: ProductFormData = {
  name: "", slug: "", categoryIds: [], description: "",
  basePrice: "", salePrice: "", stockQuantity: "0",
  sku: "", images: [], detailContentType: "images", detailImages: [], detailEditorHtml: "", tags: "",
  isActive: true, isFeatured: false,
  recommenderCrewId: "", recommendationNote: "",
  relatedProducts: [],
  vendorId: "", vendorCostType: "rate", vendorCostRate: "0", vendorSupplyPrice: "0",
};

// 상세페이지 이미지 목록을 안전한 <img> 태그 나열 HTML로 변환
// (자유 HTML 입력을 받지 않고 검증된 업로드 URL만 조합하므로 XSS 위험이 없음)
function buildDetailContentHtml(images: UploadedImage[]): string | null {
  if (images.length === 0) return null;
  const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return images
    .map((img) => `<img src="${escapeAttr(img.url)}" alt="${escapeAttr(img.alt || "")}" style="width:100%;display:block;" />`)
    .join("\n");
}

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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!productId;

  const [relatedSearch, setRelatedSearch] = useState("");
  const [relatedResults, setRelatedResults] = useState<{ id: string; name: string; thumbnail: string | null }[]>([]);
  const [relatedSearching, setRelatedSearching] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(({ data }) => setCategories(data ?? []));
    fetch("/api/admin/crews").then((r) => r.json()).then(({ data }) => setCrews(data ?? []));
    fetch("/api/admin/vendors").then((r) => r.json()).then(({ data }) => setVendors(data ?? []));
  }, []);

  useEffect(() => {
    if (!relatedSearch.trim()) { setRelatedResults([]); return; }
    const timer = setTimeout(() => {
      setRelatedSearching(true);
      fetch(`/api/admin/products?search=${encodeURIComponent(relatedSearch.trim())}&limit=8&status=all`)
        .then((r) => r.json())
        .then(({ data }) => setRelatedResults((data?.products ?? []).map((p: { id: string; name: string; thumbnail: string | null }) => ({ id: p.id, name: p.name, thumbnail: p.thumbnail }))))
        .finally(() => setRelatedSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [relatedSearch]);

  const addRelatedProduct = (p: RelatedProductPick) => {
    if (p.id === productId) return;
    setForm((prev) => (prev.relatedProducts.some((r) => r.id === p.id) ? prev : { ...prev, relatedProducts: [...prev.relatedProducts, p] }));
    setRelatedSearch("");
    setRelatedResults([]);
  };

  const removeRelatedProduct = (id: string) =>
    setForm((prev) => ({ ...prev, relatedProducts: prev.relatedProducts.filter((r) => r.id !== id) }));

  const moveRelatedProduct = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    setForm((prev) => {
      if (targetIndex < 0 || targetIndex >= prev.relatedProducts.length) return prev;
      const reordered = [...prev.relatedProducts];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return { ...prev, relatedProducts: reordered };
    });
  };

  const set = (field: keyof ProductFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCategory = (categoryId: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...prev.categoryIds, categoryId]
        : prev.categoryIds.filter((id) => id !== categoryId),
    }));

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
      categoryIds: form.categoryIds,
      description: form.description || null,
      basePrice: parseInt(form.basePrice, 10),
      salePrice: form.salePrice ? parseInt(form.salePrice, 10) : null,
      stockQuantity: parseInt(form.stockQuantity, 10) || 0,
      sku: form.sku || null,
      images: form.images.map((img, idx) => ({ url: img.url, alt: img.alt || form.name, sortOrder: idx })),
      detailContentType: form.detailContentType,
      content: form.detailContentType === "editor" ? form.detailEditorHtml : buildDetailContentHtml(form.detailImages),
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      recommenderCrewId: form.recommenderCrewId || null,
      recommendationNote: form.recommendationNote || null,
      relatedProductIds: form.relatedProducts.map((r) => r.id),
      vendorId: form.vendorId || null,
      vendorCostType: form.vendorCostType,
      vendorCostRate: parseFloat(form.vendorCostRate) || 0,
      vendorSupplyPrice: parseInt(form.vendorSupplyPrice, 10) || 0,
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
            <label className="admin-label">카테고리 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(중복 선택 가능)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
              {categories.length === 0 && (
                <p className="admin-input-hint" style={{ margin: 0 }}>등록된 카테고리가 없습니다.</p>
              )}
              {categories.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={(e) => toggleCategory(c.id, e.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
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

      {/* 업체 연결 / 공급 조건 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>🏢 업체 연결 / 공급 조건</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          <div className="admin-field" style={{ gridColumn: "1 / -1" }}>
            <label className="admin-label">공급 업체</label>
            <select
              className="admin-select"
              value={form.vendorId}
              onChange={(e) => {
                const vendorId = e.target.value;
                set("vendorId", vendorId);
                if (vendorId) {
                  const v = vendors.find((x) => x.id === vendorId);
                  if (v) {
                    set("vendorCostType", v.default_cost_type);
                    set("vendorCostRate", String(v.default_cost_rate));
                    set("vendorSupplyPrice", String(v.default_cost_price ?? 0));
                  }
                }
              }}
            >
              <option value="">업체 없음 (자사 상품)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.default_cost_type === "rate" ? `기본 ${v.default_cost_rate}%` : `기본 ${(v.default_cost_price ?? 0).toLocaleString()}원`})
                </option>
              ))}
            </select>
            {vendors.length === 0 && (
              <p className="admin-input-hint" style={{ color: "#d97706" }}>⚠️ 업체 관리에서 업체를 먼저 등록해주세요.</p>
            )}
          </div>
          <div className="admin-field">
            <label className="admin-label">공급 방식</label>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="radio" name="vendorCostType" value="rate" checked={form.vendorCostType === "rate"} onChange={() => set("vendorCostType", "rate")} />
                <span>판매가의 % (원가율)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="radio" name="vendorCostType" value="fixed" checked={form.vendorCostType === "fixed"} onChange={() => set("vendorCostType", "fixed")} />
                <span>고정 공급가 (원)</span>
              </label>
            </div>
          </div>
          {form.vendorCostType === "rate" ? (
            <div className="admin-field">
              <label className="admin-label">원가율 (%)</label>
              <input type="number" className="admin-input" value={form.vendorCostRate} onChange={(e) => set("vendorCostRate", e.target.value)} min={0} max={100} step={0.1} placeholder="60" />
              <p className="admin-input-hint">업체 선택 시 기본값 자동 입력. 상품별 개별 조정 가능.</p>
            </div>
          ) : (
            <div className="admin-field">
              <label className="admin-label">고정 공급가 (원)</label>
              <input type="number" className="admin-input" value={form.vendorSupplyPrice} onChange={(e) => set("vendorSupplyPrice", e.target.value)} min={0} placeholder="7000" />
              <p className="admin-input-hint">할인/쿠폰과 무관하게 고정된 금액을 업체에 지급합니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 상품 이미지 (썸네일 갤러리) */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>상품 이미지</h2>
        <MultiImageUploader
          images={form.images}
          onChange={(images) => setForm((prev) => ({ ...prev, images }))}
          hint="목록/카드에 보여지는 상품 이미지입니다. jpg/png/webp/gif, 장당 5MB 이하. 첫 번째 이미지가 대표 썸네일입니다."
        />
      </div>

      {/* 상세페이지 내용 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "0.75rem" }}>상세페이지 내용</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <label
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
              padding: "0.75rem 1rem", borderRadius: "10px",
              border: form.detailContentType === "images" ? "1.5px solid #db2777" : "1px solid #e5e7eb",
              background: form.detailContentType === "images" ? "#fdf2f8" : "#fff",
              fontSize: "0.875rem", fontWeight: 600,
            }}
          >
            <input
              type="radio" name="detailContentType" value="images"
              checked={form.detailContentType === "images"}
              onChange={() => setForm((prev) => ({ ...prev, detailContentType: "images" }))}
            />
            🖼️ 이미지 나열형
          </label>
          <label
            style={{
              flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer",
              padding: "0.75rem 1rem", borderRadius: "10px",
              border: form.detailContentType === "editor" ? "1.5px solid #db2777" : "1px solid #e5e7eb",
              background: form.detailContentType === "editor" ? "#fdf2f8" : "#fff",
              fontSize: "0.875rem", fontWeight: 600,
            }}
          >
            <input
              type="radio" name="detailContentType" value="editor"
              checked={form.detailContentType === "editor"}
              onChange={() => setForm((prev) => ({ ...prev, detailContentType: "editor" }))}
            />
            ✍️ 블로그 에디터형
          </label>
        </div>

        {form.detailContentType === "images" ? (
          <>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem" }}>
              상품 상세페이지 하단에 순서대로 이어붙여 표시됩니다. 상세 설명 이미지를 원하는 순서대로 올려주세요.
            </p>
            <MultiImageUploader
              images={form.detailImages}
              onChange={(detailImages) => setForm((prev) => ({ ...prev, detailImages }))}
              hint="jpg/png/webp/gif, 장당 5MB 이하. 여러 장을 올리면 위에서 아래로 이어붙여 보여집니다."
            />
          </>
        ) : (
          <>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem" }}>
              블로그처럼 사진과 글을 자유롭게 섞어서 작성할 수 있습니다. 이미지는 붙여넣기/드래그하면 자동 업로드됩니다.
            </p>
            <BlogDetailEditor
              initialHtml={form.detailEditorHtml}
              onChange={(html) => setForm((prev) => ({ ...prev, detailEditorHtml: html }))}
            />
          </>
        )}
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

      {/* 연관상품 */}
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>🔗 연관상품 지정</h2>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem" }}>
          상품 상세페이지 하단 &quot;연관 상품&quot;에 지정한 순서대로 표시됩니다. 지정하지 않으면 같은 카테고리 상품이 자동으로 표시됩니다.
        </p>
        <div className="admin-field" style={{ position: "relative", marginBottom: "1rem" }}>
          <label className="admin-label">상품 검색으로 추가</label>
          <input
            className="admin-input"
            value={relatedSearch}
            onChange={(e) => setRelatedSearch(e.target.value)}
            placeholder="상품명으로 검색..."
          />
          {relatedSearch.trim() && (
            <div
              className="admin-card"
              style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                marginTop: "0.25rem", padding: "0.5rem", maxHeight: "260px", overflowY: "auto",
              }}
            >
              {relatedSearching ? (
                <p style={{ fontSize: "0.8125rem", color: "#9ca3af", padding: "0.5rem" }}>검색 중...</p>
              ) : relatedResults.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "#9ca3af", padding: "0.5rem" }}>검색 결과가 없습니다.</p>
              ) : (
                relatedResults
                  .filter((p) => p.id !== productId)
                  .map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => addRelatedProduct(p)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.625rem", width: "100%",
                        padding: "0.5rem", background: "none", border: "none", cursor: "pointer",
                        textAlign: "left", fontSize: "0.875rem", borderRadius: "6px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {p.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                      ) : (
                        <div style={{ width: "32px", height: "32px", borderRadius: "4px", background: "#f3f4f6" }} />
                      )}
                      <span>{p.name}</span>
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
        {form.relatedProducts.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>지정된 연관상품이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {form.relatedProducts.map((p, index) => (
              <div
                key={p.id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem",
                  padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px",
                }}
              >
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                ) : (
                  <div style={{ width: "32px", height: "32px", borderRadius: "4px", background: "#f3f4f6" }} />
                )}
                <span style={{ flex: 1, fontSize: "0.875rem" }}>{p.name}</span>
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => moveRelatedProduct(index, -1)} disabled={index === 0} title="위로 이동">▲</button>
                <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => moveRelatedProduct(index, 1)} disabled={index === form.relatedProducts.length - 1} title="아래로 이동">▼</button>
                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeRelatedProduct(p.id)}>삭제</button>
              </div>
            ))}
          </div>
        )}
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

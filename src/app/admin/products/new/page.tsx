"use client";
// /admin/products/new — 상품 등록
// ?copyFrom=<productId> 로 접근하면 기존 상품 정보를 복사해 새 상품(예: 포인트몰용)으로 등록할 수 있다.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProductForm, { type ProductFormData } from "@/components/admin/ProductForm";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export default function NewProductPage() {
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get("copyFrom");
  const [initialData, setInitialData] = useState<Partial<ProductFormData> | null>(null);
  const [loading, setLoading] = useState(!!copyFrom);

  useEffect(() => {
    if (!copyFrom) return;
    fetch(`/api/admin/products/${copyFrom}`)
      .then((r) => r.json())
      .then(({ data, success }) => {
        if (!success || !data) return;
        const images = (data.images as { url: string; alt: string }[] ?? [])
          .map((img) => ({ url: img.url, alt: img.alt ?? "" }));
        const detailContentType: "images" | "editor" = data.detail_content_type === "editor" ? "editor" : "images";
        const detailImages = detailContentType === "images"
          ? Array.from(
              (data.content as string ?? "").matchAll(/<img[^>]*\ssrc="([^"]*)"[^>]*\salt="([^"]*)"[^>]*>/g)
            ).map((m) => ({
              url: m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"),
              alt: m[2].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"),
            }))
          : [];
        const detailEditorHtml = detailContentType === "editor" ? (data.content as string ?? "") : "";
        setInitialData({
          name: `${data.name ?? ""} (사본)`,
          slug: toSlug(`${data.slug ?? ""}-copy-${Date.now().toString(36)}`),
          categoryIds: data.categoryIds ?? (data.category_id ? [data.category_id] : []),
          description: data.description ?? "",
          basePrice: String(data.base_price ?? ""),
          salePrice: data.sale_price ? String(data.sale_price) : "",
          stockQuantity: String(data.stock_quantity ?? 0),
          sku: "",
          images,
          detailContentType,
          detailImages,
          detailEditorHtml,
          tags: (data.tags ?? []).join(", "),
          isActive: data.is_active ?? true,
          isFeatured: false,
          recommenderCrewId: data.recommender_crew_id ?? "",
          recommendationNote: data.recommendation_note ?? "",
          relatedProducts: [],
          pointRatio: data.point_ratio != null ? String(data.point_ratio) : "",
        });
      })
      .finally(() => setLoading(false));
  }, [copyFrom]);

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">{copyFrom ? "상품 복사 등록" : "상품 등록"}</h1>
        <Link href="/admin/products" className="admin-btn admin-btn-secondary">← 목록으로</Link>
      </div>
      {copyFrom && (
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem" }}>
          기존 상품 정보를 복사했습니다. 슬러그가 자동으로 변경되었으니 필요하면 수정하고, 카테고리와 포인트몰 사용 비율을 새로 지정한 뒤 등록하세요.
        </p>
      )}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
      ) : (
        <ProductForm initialData={initialData ?? undefined} />
      )}
    </>
  );
}

"use client";
// /admin/products/[id] — 상품 수정

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductForm, { type ProductFormData } from "@/components/admin/ProductForm";
import ProductVideosManager from "@/components/admin/ProductVideosManager";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [initialData, setInitialData] = useState<Partial<ProductFormData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setProductId(id);
      fetch(`/api/admin/products/${id}`)
        .then((r) => r.json())
        .then(({ data, success }) => {
          if (!success || !data) { setNotFound(true); return; }
          const images = data.images as { url: string; alt: string }[] ?? [];
          setInitialData({
            name: data.name ?? "",
            slug: data.slug ?? "",
            categoryId: data.category_id ?? "",
            description: data.description ?? "",
            basePrice: String(data.base_price ?? ""),
            salePrice: data.sale_price ? String(data.sale_price) : "",
            stockQuantity: String(data.stock_quantity ?? 0),
            sku: data.sku ?? "",
            imageUrl: images[0]?.url ?? "",
            imageAlt: images[0]?.alt ?? "",
            tags: (data.tags ?? []).join(", "),
            isActive: data.is_active ?? true,
            isFeatured: data.is_featured ?? false,
            recommenderCrewId: data.recommender_crew_id ?? "",
            recommendationNote: data.recommendation_note ?? "",
          });
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>;
  }

  if (notFound) {
    return (
      <div className="admin-empty" style={{ paddingTop: "5rem" }}>
        <div className="admin-empty-icon">🔍</div>
        <p className="admin-empty-title">상품을 찾을 수 없습니다</p>
        <Link href="/admin/products" className="admin-btn admin-btn-primary" style={{ marginTop: "1rem", display: "inline-flex" }}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">상품 수정</h1>
        <Link href="/admin/products" className="admin-btn admin-btn-secondary">← 목록으로</Link>
      </div>
      {initialData && (
        <ProductForm
          productId={productId}
          initialData={initialData}
          onSuccess={() => router.push("/admin/products")}
        />
      )}
      {productId && <ProductVideosManager productId={productId} />}
    </>
  );
}

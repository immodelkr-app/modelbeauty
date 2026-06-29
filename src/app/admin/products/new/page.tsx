"use client";
// /admin/products/new — 상품 등록

import Link from "next/link";
import ProductForm from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">상품 등록</h1>
        <Link href="/admin/products" className="admin-btn admin-btn-secondary">← 목록으로</Link>
      </div>
      <ProductForm />
    </>
  );
}

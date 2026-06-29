"use client";

// ============================================================
// /admin/products — 상품 목록
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  stockQuantity: number;
  isActive: boolean;
  isFeatured: boolean;
  thumbnail: string | null;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
}

interface Category { id: string; name: string; }

function formatPrice(n: number) { return n.toLocaleString("ko-KR") + "원"; }

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search) qs.set("search", search);
    if (categoryId) qs.set("categoryId", categoryId);
    if (status) qs.set("status", status);

    const res = await fetch(`/api/admin/products?${qs}`);
    const { data } = await res.json();
    setProducts(data?.products ?? []);
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [page, search, categoryId, status]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // 카테고리 로드
  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(({ data }) => setCategories(data ?? []));
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 상품을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (res.ok) fetchProducts();
    else alert("삭제에 실패했습니다.");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchProducts();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">상품 관리 <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>({total}개)</span></h1>
        <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
          ＋ 상품 등록
        </Link>
      </div>

      {/* 필터 바 */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrap">
          <span className="admin-search-icon">🔍</span>
          <input
            type="search"
            className="admin-search"
            placeholder="상품명 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="admin-filter-select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">전체 카테고리</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="admin-filter-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">전체 상태</option>
          <option value="active">판매중</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : products.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🛍️</div>
              <p className="admin-empty-title">상품이 없습니다</p>
              <p className="admin-empty-desc">상품을 등록해보세요.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>상품</th>
                  <th>카테고리</th>
                  <th>가격</th>
                  <th>재고</th>
                  <th>상태</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div className="admin-table-thumb">
                          {p.thumbnail
                            ? <Image src={p.thumbnail} alt={p.name} fill sizes="44px" style={{ objectFit: "cover" }} />
                            : "💄"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#111827" }}>{p.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.category?.name ?? <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{formatPrice(p.salePrice ?? p.basePrice)}</div>
                      {p.salePrice && <div style={{ fontSize: "0.75rem", color: "#9ca3af", textDecoration: "line-through" }}>{formatPrice(p.basePrice)}</div>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: p.stockQuantity <= 10 ? "#dc2626" : "#111827" }}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        className={`admin-badge ${p.isActive ? "admin-badge-green" : "admin-badge-gray"}`}
                        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
                        title="클릭하여 상태 변경"
                      >
                        {p.isActive ? "판매중" : "비활성"}
                      </button>
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
                      {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <Link href={`/admin/products/${p.id}`} className="admin-btn admin-btn-secondary admin-btn-sm">
                          수정
                        </Link>
                        <button onClick={() => handleDelete(p.id, p.name)} className="admin-btn admin-btn-danger admin-btn-sm">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <span>{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} / {total}개</span>
            <div className="admin-pagination-btns">
              <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 이전</button>
              <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음 →</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

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

  // CSV 업로드 상태
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    failures: { row: number; name: string; reason: string }[];
  } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

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

  // CSV 템플릿 다운로드 핸들러
  const handleDownloadTemplate = () => {
    const headers = ["상품명", "슬러그", "카테고리명", "기본가격", "판매가격", "재고수량", "SKU", "상세설명", "태그", "활성화여부", "추천여부"];
    const sampleRow = [
      "여름 쿨톤 수분 틴트",
      "summer-cool-tint",
      "립메이크업",
      "18000",
      "15000",
      "150",
      "SKU-TINT-01",
      "하루종일 촉촉함을 유지시켜주는 여름 쿨톤용 틴트",
      "틴트,립,메이크업",
      "Y",
      "Y"
    ];
    
    const csvContent = [headers, sampleRow]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // 국문이 Excel에서 열었을 때 깨지지 않도록 UTF-8 BOM 추가
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelbeauty_products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV 파일 대량 임포트 핸들러
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 업로드 창 인풋 초기화 (같은 파일 다시 선택 시도 가능하게)
    e.target.value = "";

    const ok = confirm(`"${file.name}" 파일을 업로드하여 상품 대량 등록을 진행하시겠습니까?`);
    if (!ok) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success && result.data) {
        setImportResult(result.data);
        setShowResultModal(true);
        fetchProducts(); // 리스트 갱신
      } else {
        alert(result.error ?? "대량 등록 도중 알 수 없는 에러가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("네트워크 통신 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">상품 관리 <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>({total}개)</span></h1>
        
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            onClick={handleDownloadTemplate}
            className="admin-btn"
            style={{
              borderColor: "#10b981",
              color: "#10b981",
              backgroundColor: "#f0fdf4",
              fontWeight: 700,
            }}
          >
            📥 템플릿 다운로드
          </button>
          
          <label 
            className="admin-btn admin-btn-secondary" 
            style={{ 
              cursor: importing ? "not-allowed" : "pointer", 
              display: "inline-flex", 
              alignItems: "center",
              opacity: importing ? 0.6 : 1
            }}
          >
            {importing ? "🔄 업로드 중..." : "📤 대량 등록 (CSV)"}
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleImportCSV} 
              style={{ display: "none" }} 
              disabled={importing} 
            />
          </label>

          <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
            ＋ 상품 등록
          </Link>
        </div>
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
                        <div className="admin-table-thumb" style={{ position: "relative", width: "44px", height: "44px" }}>
                          {p.thumbnail
                            ? <Image src={p.thumbnail} alt={p.name} fill sizes="44px" style={{ objectFit: "cover", borderRadius: "4px" }} />
                            : <div style={{ width: "100%", height: "100%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", fontSize: "1.2rem" }}>💄</div>}
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

      {/* CSV 대량등록 결과 요약 모달 */}
      {showResultModal && importResult && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container" style={{ maxWidth: "600px" }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">📊 CSV 대량 등록 완료 보고</h2>
              <button onClick={() => setShowResultModal(false)} className="admin-modal-close-btn">
                ✕
              </button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ flex: 1, padding: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.875rem", color: "#16a34a", fontWeight: 700 }}>성공 등록 건수</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#15803d", marginTop: "0.25rem" }}>
                    {importResult.successCount}건
                  </div>
                </div>
                <div style={{ flex: 1, padding: "1rem", background: importResult.failureCount > 0 ? "#fef2f2" : "#f9fafb", border: importResult.failureCount > 0 ? "1px solid #fecaca" : "1px solid #e5e7eb", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.875rem", color: importResult.failureCount > 0 ? "#dc2626" : "#4b5563", fontWeight: 700 }}>실패(오류) 건수</div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: importResult.failureCount > 0 ? "#b91c1c" : "#111827", marginTop: "0.25rem" }}>
                    {importResult.failureCount}건
                  </div>
                </div>
              </div>

              {importResult.failureCount > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.5rem", color: "#374151" }}>
                    ❌ 행별 오류 상세 내역
                  </h3>
                  <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#f9fafb" }}>
                    <table className="admin-table" style={{ fontSize: "0.8125rem" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "0.5rem 0.75rem" }}>위치</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>상품명</th>
                          <th style={{ padding: "0.5rem 0.75rem" }}>오류 원인</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.failures.map((f, idx) => (
                          <tr key={idx}>
                            <td className="admin-text-mono" style={{ padding: "0.5rem 0.75rem" }}>{f.row}행</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{f.name}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#dc2626" }}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-modal-footer" style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setShowResultModal(false)} className="admin-btn admin-btn-primary">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";
// /admin/categories — 카테고리 관리

import { useState, useEffect, useCallback } from "react";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  parent_id: string | null;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 40);
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSort, setNewSort] = useState("0");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/categories");
    const { data } = await res.json();
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newSlug) return;
    setAdding(true);
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug, sortOrder: parseInt(newSort, 10) || 0 }),
    });
    setNewName(""); setNewSlug(""); setNewSort("0");
    setAdding(false);
    fetchCategories();
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchCategories();
  };

  const handleEditSave = async (id: string) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditId(null);
    fetchCategories();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    fetchCategories();
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">카테고리 관리</h1>
      </div>

      {/* 카테고리 추가 폼 */}
      <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>카테고리 추가</h2>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="admin-field" style={{ flex: 2, minWidth: "160px" }}>
            <label className="admin-label admin-label-required">이름</label>
            <input className="admin-input" value={newName} onChange={(e) => { setNewName(e.target.value); setNewSlug(toSlug(e.target.value)); }} required placeholder="스킨케어" />
          </div>
          <div className="admin-field" style={{ flex: 2, minWidth: "160px" }}>
            <label className="admin-label admin-label-required">Slug</label>
            <input className="admin-input" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} required placeholder="skincare" pattern="[a-z0-9-]+" />
          </div>
          <div className="admin-field" style={{ width: "80px" }}>
            <label className="admin-label">순서</label>
            <input type="number" className="admin-input" value={newSort} onChange={(e) => setNewSort(e.target.value)} min={0} />
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={adding} style={{ alignSelf: "flex-end" }}>
            {adding ? "추가 중..." : "추가"}
          </button>
        </form>
      </div>

      {/* 카테고리 목록 */}
      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : categories.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🗂️</div>
              <p className="admin-empty-title">카테고리가 없습니다</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>Slug</th>
                  <th>순서</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      {editId === cat.id ? (
                        <input className="admin-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus style={{ maxWidth: "200px" }} />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                      )}
                    </td>
                    <td className="admin-text-mono">{cat.slug}</td>
                    <td>{cat.sort_order}</td>
                    <td>
                      <button
                        className={`admin-badge ${cat.is_active ? "admin-badge-green" : "admin-badge-gray"}`}
                        onClick={() => handleToggleActive(cat.id, cat.is_active)}
                        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
                      >
                        {cat.is_active ? "활성" : "비활성"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        {editId === cat.id ? (
                          <>
                            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleEditSave(cat.id)}>저장</button>
                            <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setEditId(null)}>취소</button>
                          </>
                        ) : (
                          <>
                            <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>수정</button>
                            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(cat.id, cat.name)}>삭제</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

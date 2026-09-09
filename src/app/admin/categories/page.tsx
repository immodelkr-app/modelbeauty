"use client";
// /admin/categories — 카테고리 관리

import { useState, useEffect, useCallback, Fragment } from "react";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  parent_id: string | null;
  is_point_mall: boolean;
  point_period_starts_at: string | null;
  point_period_ends_at: string | null;
}

// datetime-local input value(로컬 타임존, 초 없음) ↔ ISO 문자열 변환
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [pmEditId, setPmEditId] = useState<string | null>(null);
  const [pmEnabled, setPmEnabled] = useState(false);
  const [pmStart, setPmStart] = useState("");
  const [pmEnd, setPmEnd] = useState("");

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

  const openPointMallEdit = (cat: CategoryRow) => {
    setPmEditId(cat.id);
    setPmEnabled(cat.is_point_mall);
    setPmStart(toDatetimeLocal(cat.point_period_starts_at));
    setPmEnd(toDatetimeLocal(cat.point_period_ends_at));
  };

  const handlePointMallSave = async (id: string) => {
    if (pmEnabled && pmStart && pmEnd && new Date(pmStart) >= new Date(pmEnd)) {
      alert("종료 일시는 시작 일시보다 이후여야 합니다.");
      return;
    }
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPointMall: pmEnabled,
        pointPeriodStartsAt: pmStart ? new Date(pmStart).toISOString() : null,
        pointPeriodEndsAt: pmEnd ? new Date(pmEnd).toISOString() : null,
      }),
    });
    setPmEditId(null);
    fetchCategories();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    fetchCategories();
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const current = categories[index];
    const target = categories[targetIndex];

    // 화면에는 즉시 반영
    const reordered = [...categories];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setCategories(reordered);

    await Promise.all([
      fetch(`/api/admin/categories/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: target.sort_order }),
      }),
      fetch(`/api/admin/categories/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: current.sort_order }),
      }),
    ]);
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
                  <th>포인트몰</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, index) => (
                  <Fragment key={cat.id}>
                  <tr>
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
                      <button
                        type="button"
                        className={`admin-badge ${cat.is_point_mall ? "admin-badge-green" : "admin-badge-gray"}`}
                        onClick={() => openPointMallEdit(cat)}
                        style={{ cursor: "pointer", border: "none", fontFamily: "inherit" }}
                        title="포인트몰 여부/활동기간 설정"
                      >
                        {cat.is_point_mall ? "포인트몰" : "일반"}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => handleMove(index, -1)}
                          disabled={index === 0}
                          title="위로 이동"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => handleMove(index, 1)}
                          disabled={index === categories.length - 1}
                          title="아래로 이동"
                        >
                          ▼
                        </button>
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
                  {pmEditId === cat.id && (
                    <tr>
                      <td colSpan={6} style={{ background: "#fdf2f8", padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", fontWeight: 600 }}>
                            <input type="checkbox" checked={pmEnabled} onChange={(e) => setPmEnabled(e.target.checked)} />
                            포인트몰 카테고리로 운영
                          </label>
                          <div className="admin-field" style={{ minWidth: "200px" }}>
                            <label className="admin-label">활동 시작</label>
                            <input type="datetime-local" className="admin-input" value={pmStart} onChange={(e) => setPmStart(e.target.value)} disabled={!pmEnabled} />
                          </div>
                          <div className="admin-field" style={{ minWidth: "200px" }}>
                            <label className="admin-label">활동 종료</label>
                            <input type="datetime-local" className="admin-input" value={pmEnd} onChange={(e) => setPmEnd(e.target.value)} disabled={!pmEnabled} />
                          </div>
                          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handlePointMallSave(cat.id)}>저장</button>
                          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setPmEditId(null)}>취소</button>
                        </div>
                        <p className="admin-input-hint" style={{ margin: "0.5rem 0 0" }}>
                          카테고리 메뉴는 항상 노출되며, 활동기간 밖에는 이 카테고리에 들어오면 &quot;포인트 사용기간이 아닙니다&quot; 안내가 표시됩니다. 기간을 비워두면 언제나 활성 상태입니다.
                        </p>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

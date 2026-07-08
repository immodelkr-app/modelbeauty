"use client";

// ============================================================
// /admin/users — 관리자 전체 회원 관리 대시보드
// Supabase Auth 가입 회원 목록 + im-core-auth 통합 포인트/쿠폰 실시간 연동
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";

interface UserSummary {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  masterUserId: string;
  createdAt: string;
  lastSignInAt: string | null;
}

interface UserDetail extends UserSummary {
  points: number;
  coupons: any[];
  ordersSummary: {
    count: number;
    spent: number;
  };
  orders: any[];
  _coreAuthOffline?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // 모달 상세 정보
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      }
    } catch (e) {
      console.error("회원 목록 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").replace(/-/g, "");
      const cleanQ = q.replace(/-/g, "");
      return name.includes(q) || email.includes(q) || phone.includes(cleanQ);
    });
    setFilteredUsers(filtered);
  }, [search, users]);

  const handleViewDetail = async (userId: string) => {
    setModalLoading(true);
    setShowModal(true);
    setSelectedUser(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedUser(data.user);
      }
    } catch (e) {
      console.error("상세 정보 조회 실패:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string | null) => {
    const displayName = userName ? `"${userName}"` : "이 사용자";
    const confirm1 = confirm(`${displayName} 회원을 강제로 탈퇴 처리하시겠습니까?\n이 작업은 Supabase 인증 계정을 삭제하며 되돌릴 수 없습니다.`);
    if (!confirm1) return;

    const confirm2 = confirm(`정말로 삭제하시겠습니까? 삭제 시 해당 회원은 로그인이 불가능해집니다.\n동의하시면 확인을 눌러주세요.`);
    if (!confirm2) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("✅ 회원이 성공적으로 강제 탈퇴 처리되었습니다.");
        setShowModal(false);
        fetchUsers();
      } else {
        alert(data.error ?? "회원 삭제 실패");
      }
    } catch (e) {
      console.error("회원 탈퇴 요청 실패:", e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dStr: string | null) => {
    if (!dStr) return "-";
    const d = new Date(dStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="admin-content-inner">
      {/* 상단 툴바 */}
      <div className="admin-toolbar" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="🔍 이름, 이메일, 전화번호 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input"
          style={{ maxWidth: "320px", width: "100%" }}
        />
        <button
          onClick={fetchUsers}
          className="admin-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.625rem 1rem", fontSize: "0.875rem" }}
        >
          🔄 새로고침
        </button>
      </div>

      {/* 테이블 목록 */}
      {loading ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--mb-gray-400)" }}>
          ⏳ 회원 목록을 불러오는 중...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="admin-empty-box" style={{ padding: "4rem", textAlign: "center", background: "rgba(30, 41, 59, 0.4)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.05)" }}>
          📭 검색 조건과 일치하는 회원이 없습니다.
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>닉네임</th>
                <th>이메일 주소</th>
                <th>휴대폰 번호</th>
                <th>가입일시</th>
                <th>최근 접속일시</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, color: "var(--mb-pink-500)" }}>{u.name || <span style={{ color: "var(--mb-gray-600)" }}>(미설정)</span>}</td>
                  <td>{u.email || <span style={{ color: "var(--mb-gray-600)" }}>-</span>}</td>
                  <td>{u.phone || <span style={{ color: "var(--mb-gray-600)" }}>-</span>}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{formatDate(u.lastSignInAt)}</td>
                  <td>
                    <button
                      onClick={() => handleViewDetail(u.id)}
                      className="admin-btn-primary"
                      style={{ padding: "6px 12px", fontSize: "0.8125rem", borderRadius: "6px", cursor: "pointer" }}
                    >
                      상세 정보
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {showModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.75)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 1000,
            padding: "1rem", backdropFilter: "blur(4px)"
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#0f172a", color: "#f8fafc", width: "100%", maxWidth: "680px",
              borderRadius: "16px", padding: "1.5rem", border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", maxHeight: "90vh", overflowY: "auto"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#ec4899", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>👤</span> 회원 상세 관리
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {modalLoading ? (
              <div style={{ padding: "4rem 0", textAlign: "center", color: "#94a3b8" }}>
                ⏳ 실시간 포인트/쿠폰 및 결제 정보를 가져오는 중...
              </div>
            ) : selectedUser ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* 기본 정보 */}
                <section>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>기본 프로필</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "rgba(15,23,42,0.6)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>닉네임</span>
                      <strong style={{ fontSize: "0.9375rem", color: "#f1f5f9" }}>{selectedUser.name || "-"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>이메일</span>
                      <strong style={{ fontSize: "0.9375rem", color: "#f1f5f9" }}>{selectedUser.email || "-"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>휴대폰 번호</span>
                      <strong style={{ fontSize: "0.9375rem", color: "#f1f5f9" }}>{selectedUser.phone || "-"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>가입일시</span>
                      <span style={{ fontSize: "0.875rem", color: "#cbd5e1" }}>{formatDate(selectedUser.createdAt)}</span>
                    </div>
                  </div>
                  {/* 강제 탈퇴 위험 버튼 */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                    <button
                      onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name)}
                      disabled={deleting}
                      className="admin-btn-danger"
                      style={{
                        padding: "6px 14px",
                        fontSize: "0.8125rem",
                        borderRadius: "8px",
                        cursor: deleting ? "not-allowed" : "pointer",
                        border: "1px solid #ef4444",
                        background: "rgba(239,68,68,0.1)",
                        color: "#f87171",
                        fontWeight: 600,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#ef4444";
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                        e.currentTarget.style.color = "#f87171";
                      }}
                    >
                      {deleting ? "⏳ 탈퇴 처리 중..." : "🚫 회원 강제 탈퇴"}
                    </button>
                  </div>
                </section>

                {/* 실시간 통합 서비스 상태 */}
                <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {/* 포인트 */}
                  <div style={{ background: "rgba(236,72,153,0.03)", border: "1px solid rgba(236,72,153,0.15)", padding: "1rem", borderRadius: "12px" }}>
                    <div style={{ fontSize: "0.8125rem", color: "#fbcfe8", fontWeight: 600 }}>통합 포인트 잔액</div>
                    <div style={{ fontSize: "1.625rem", fontWeight: 900, color: "#ec4899", marginTop: "0.25rem" }}>
                      {selectedUser.points.toLocaleString()} <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>P</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#fbcfe8", opacity: 0.6, marginTop: "0.25rem" }}>
                      MOCA · IMFF · 모델뷰티 통합
                    </div>
                  </div>

                  {/* 보유 쿠폰 수 */}
                  <div style={{ background: "rgba(147,51,234,0.03)", border: "1px solid rgba(147,51,234,0.15)", padding: "1rem", borderRadius: "12px" }}>
                    <div style={{ fontSize: "0.8125rem", color: "#e9d5ff", fontWeight: 600 }}>사용 가능한 쿠폰</div>
                    <div style={{ fontSize: "1.625rem", fontWeight: 900, color: "#a855f7", marginTop: "0.25rem" }}>
                      {selectedUser.coupons.length} <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>장</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#e9d5ff", opacity: 0.6, marginTop: "0.25rem" }}>
                      미사용 상태 쿠폰 수
                    </div>
                  </div>
                </section>

                {/* 쿠폰 목록 */}
                {selectedUser.coupons.length > 0 && (
                  <section>
                    <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.5rem" }}>쿠폰 보유 상세</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "120px", overflowY: "auto" }}>
                      {selectedUser.coupons.map((c: any) => (
                        <div key={c.userCouponId} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "0.625rem 0.875rem", borderRadius: "8px", fontSize: "0.8125rem" }}>
                          <span style={{ fontWeight: 600, color: "#cbd5e1" }}>🏷️ {c.name}</span>
                          <span style={{ color: "#ec4899", fontWeight: 800 }}>
                            {c.discountType === "fixed" ? `${c.discountValue.toLocaleString()}원` : `${c.discountValue}%`} 할인
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 쇼핑 주문 요약 */}
                <section>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.5rem" }}>
                    🛍️ 모델뷰티 쇼핑 주문 내역 ({selectedUser.ordersSummary.count}건)
                  </h4>
                  <div style={{ background: "rgba(15,23,42,0.6)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.5rem" }}>
                      <span style={{ color: "#94a3b8" }}>총 실결제 누적액</span>
                      <strong style={{ color: "#ec4899", fontSize: "1rem" }}>{selectedUser.ordersSummary.spent.toLocaleString()}원</strong>
                    </div>

                    {selectedUser.orders.length === 0 ? (
                      <div style={{ fontSize: "0.8125rem", color: "#64748b", textAlign: "center", padding: "1.5rem" }}>
                        아직 쇼핑 결제 완료 내역이 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto" }}>
                        {selectedUser.orders.map((o: any) => (
                          <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15,23,42,0.3)", padding: "0.625rem 0.875rem", borderRadius: "8px", fontSize: "0.8125rem", border: "1px solid rgba(255,255,255,0.02)" }}>
                            <Link href={`/admin/orders/${o.id}`} style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
                              📄 {o.order_number}
                            </Link>
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{formatDate(o.created_at)}</span>
                            <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{o.total_amount.toLocaleString()}원</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {selectedUser._coreAuthOffline && (
                  <p style={{ color: "#ef4444", fontSize: "0.75rem", margin: 0, textAlign: "center" }}>
                    ⚠️ 현재 통합 인증 서버(im-core-auth)에 일시적으로 접속할 수 없어 실시간 포인트/쿠폰 내역 조회가 제한되었습니다.
                  </p>
                )}

              </div>
            ) : (
              <div style={{ padding: "4rem 0", textAlign: "center", color: "#ef4444" }}>
                ❌ 상세 정보를 불러오는 과정에서 오류가 발생했습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  tier: { id: string; name: string; badge_emoji: string; sort_order: number };
  isLocked: boolean;
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

interface MembershipInfo {
  currentTier: { id: string; name: string; sort_order: number; discount_rate: number; badge_emoji: string; min_amount: number };
  isLocked: boolean;
  lockReason: string | null;
  totalPurchasedLast6m: number;
  nextTier: { id: string; name: string; min_amount: number; badge_emoji: string } | null;
  amountToNextTier: number;
  allTiers: { id: string; name: string; sort_order: number; badge_emoji: string }[];
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

  // 멤버십 등급
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [gradeForm, setGradeForm] = useState({ tierId: "normal", isLocked: false, lockReason: "" });

  // ── 적립금 조정 모달 ──────────────────────────────────────
  const [showPointModal, setShowPointModal] = useState(false);
  const [pointForm, setPointForm] = useState({ type: "reward", amount: "", description: "" });
  const [pointSaving, setPointSaving] = useState(false);

  // ── 쿠폰 발급 모달 ──────────────────────────────────────
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponTemplates, setCouponTemplates] = useState<{ id: string; name: string; discountType: string; discountValue: number }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [couponIssuing, setCouponIssuing] = useState(false);
  const [couponTemplatesLoading, setCouponTemplatesLoading] = useState(false);


  // ── 솔라피 설정 확인 모달 ───────────────────────────────
  const [showSolapiCheckModal, setShowSolapiCheckModal] = useState(false);
  const [solapiConfig, setSolapiConfig] = useState<any>(null);
  const [solapiCheckLoading, setSolapiCheckLoading] = useState(false);

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
    setMembership(null);
    try {
      const [userRes, membershipRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch(`/api/admin/membership/${userId}`),
      ]);
      const userData = await userRes.json();
      const membershipData = await membershipRes.json();
      if (userData.success) setSelectedUser(userData.user);
      if (membershipData.success) {
        setMembership(membershipData.data);
        setGradeForm({
          tierId: membershipData.data.currentTier.id,
          isLocked: membershipData.data.isLocked,
          lockReason: membershipData.data.lockReason ?? "",
        });
      }
    } catch (e) {
      console.error("상세 정보 조회 실패:", e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!selectedUser) return;
    setSavingGrade(true);
    try {
      const res = await fetch(`/api/admin/membership/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: gradeForm.tierId,
          isLocked: gradeForm.isLocked,
          lockReason: gradeForm.lockReason || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ 등급이 저장되었습니다.");
        const membershipRes = await fetch(`/api/admin/membership/${selectedUser.id}`);
        const membershipData = await membershipRes.json();
        if (membershipData.success) setMembership(membershipData.data);
      } else {
        alert(result.error ?? "저장 실패");
      }
    } finally {
      setSavingGrade(false);
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

  // ── 적립금 수동 지급/차감 ─────────────────────────────────
  const handleAdjustPoints = async () => {
    if (!selectedUser) return;
    const amount = parseInt(pointForm.amount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("올바른 포인트 금액을 입력해 주세요.");
      return;
    }
    if (!pointForm.description.trim()) {
      alert("지급/차감 사유를 입력해 주세요.");
      return;
    }
    setPointSaving(true);
    try {
      const finalAmount = pointForm.type === "reward" ? amount : -amount;
      const res = await fetch(`/api/admin/users/${selectedUser.masterUserId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, description: pointForm.description }),
      });
      const result = await res.json();
      if (result.success) {
        alert(`✅ 적립금 ${pointForm.type === "reward" ? "지급" : "차감"}이 완료되었습니다.`);
        setShowPointModal(false);
        setPointForm({ type: "reward", amount: "", description: "" });
        // 회원 상세 정보 새로고침
        const userRes = await fetch(`/api/admin/users/${selectedUser.id}`);
        const userData = await userRes.json();
        if (userData.success) setSelectedUser(userData.user);
      } else {
        alert(result.error ?? "처리 실패");
      }
    } catch (e) {
      console.error("적립금 조정 실패:", e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setPointSaving(false);
    }
  };

  // ── 쿠폰 발급 ─────────────────────────────────────────────
  const handleOpenCouponModal = async () => {
    setShowCouponModal(true);
    setCouponTemplatesLoading(true);
    setSelectedTemplateId("");
    try {
      const res = await fetch("/api/admin/coupons/templates");
      const data = await res.json();
      setCouponTemplates(data.templates ?? []);
    } catch (e) {
      console.error("쿠폰 템플릿 로드 실패:", e);
      setCouponTemplates([]);
    } finally {
      setCouponTemplatesLoading(false);
    }
  };

  const handleIssueCoupon = async () => {
    if (!selectedUser || !selectedTemplateId) {
      alert("발급할 쿠폰을 선택해 주세요.");
      return;
    }
    setCouponIssuing(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.masterUserId}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponTemplateId: selectedTemplateId }),
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ 쿠폰이 성공적으로 발급되었습니다.");
        setShowCouponModal(false);
        setSelectedTemplateId("");
        // 회원 상세 정보 새로고침 (쿠폰 목록 반영)
        const userRes = await fetch(`/api/admin/users/${selectedUser.id}`);
        const userData = await userRes.json();
        if (userData.success) setSelectedUser(userData.user);
      } else {
        alert(result.error ?? "쿠폰 발급 실패");
      }
    } catch (e) {
      console.error("쿠폰 발급 실패:", e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setCouponIssuing(false);
    }
  };

  // ── 솔라피 설정 확인 ──────────────────────────────────────
  const handleCheckSolapi = async () => {
    setShowSolapiCheckModal(true);
    setSolapiCheckLoading(true);
    try {
      const res = await fetch("/api/admin/solapi-check");
      const data = await res.json();
      if (data.success) {
        setSolapiConfig(data.config);
      } else {
        alert(data.error || "솔라피 설정을 불러오지 못했습니다.");
        setShowSolapiCheckModal(false);
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
      setShowSolapiCheckModal(false);
    } finally {
      setSolapiCheckLoading(false);
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
        <button
          onClick={handleCheckSolapi}
          className="admin-btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.25rem", padding: "0.625rem 1rem", fontSize: "0.875rem", border: "1px solid rgba(236,72,153,0.3)", color: "#ec4899" }}
        >
          ⚙️ 솔라피 설정 확인
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
                  <td style={{ fontWeight: 700, color: "var(--mb-pink-500)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {u.name || <span style={{ color: "var(--mb-gray-600)" }}>(미설정)</span>}
                      <span style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                        {u.tier.badge_emoji} {u.tier.name}
                      </span>
                    </div>
                  </td>
                  <td>{u.email || <span style={{ color: "var(--mb-gray-600)" }}>-</span>}</td>
                  <td>{u.phone || <span style={{ color: "var(--mb-gray-600)" }}>-</span>}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{formatDate(u.lastSignInAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        onClick={() => handleViewDetail(u.id)}
                        className="admin-btn-primary"
                        style={{ padding: "6px 12px", fontSize: "0.8125rem", borderRadius: "6px", cursor: "pointer" }}
                      >
                        상세 정보
                      </button>
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "0.8125rem", color: "#fbcfe8", fontWeight: 600 }}>통합 포인트 잔액</div>
                      <button
                        onClick={() => { setShowPointModal(true); setPointForm({ type: "reward", amount: "", description: "" }); }}
                        style={{
                          fontSize: "0.6875rem", fontWeight: 700, padding: "3px 8px",
                          background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.4)",
                          color: "#ec4899", borderRadius: "6px", cursor: "pointer", lineHeight: 1.4,
                        }}
                      >
                        ✏️ 조정
                      </button>
                    </div>
                    <div style={{ fontSize: "1.625rem", fontWeight: 900, color: "#ec4899", marginTop: "0.25rem" }}>
                      {selectedUser.points.toLocaleString()} <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>P</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#fbcfe8", opacity: 0.6, marginTop: "0.25rem" }}>
                      MOCA · IMFF · 모델뷰티 통합
                    </div>
                  </div>

                  {/* 보유 쿠폰 수 */}
                  <div style={{ background: "rgba(147,51,234,0.03)", border: "1px solid rgba(147,51,234,0.15)", padding: "1rem", borderRadius: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontSize: "0.8125rem", color: "#e9d5ff", fontWeight: 600 }}>사용 가능한 쿠폰</div>
                      <button
                        onClick={handleOpenCouponModal}
                        style={{
                          fontSize: "0.6875rem", fontWeight: 700, padding: "3px 8px",
                          background: "rgba(147,51,234,0.2)", border: "1px solid rgba(147,51,234,0.4)",
                          color: "#a855f7", borderRadius: "6px", cursor: "pointer", lineHeight: 1.4,
                        }}
                      >
                        🎁 발급
                      </button>
                    </div>
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

                {/* 멤버십 등급 관리 */}
                <section style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1.25rem" }}>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#f1f5f9", marginBottom: "0.875rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <span>🏆</span> 멤버십 등급 관리
                  </h4>
                  {membership ? (
                    <div style={{ background: "rgba(15, 23, 42, 0.8)", padding: "1.25rem", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                      {/* 현재 등급 표시 */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid rgba(255,255,255,0.04)", paddingBottom: "0.875rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{membership.currentTier.badge_emoji}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <strong style={{ fontSize: "1.0625rem", color: "#f8fafc", fontWeight: 800 }}>{membership.currentTier.name}</strong>
                              <span style={{ fontSize: "0.8125rem", color: "#38bdf8", fontWeight: 700 }}>(할인 {membership.currentTier.discount_rate}%)</span>
                            </div>
                            <div style={{ marginTop: "0.125rem" }}>
                              {membership.isLocked && (
                                <span style={{ fontSize: "0.75rem", background: "rgba(234,179,8,0.2)", color: "#fbbf24", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                                  🔒 관리자 지정 등급 ({membership.lockReason || "잠금됨"})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#94a3b8", textAlign: "right" }}>
                          최근 6개월 누적 구매액: <strong style={{ color: "#ec4899", fontSize: "0.9375rem" }}>{membership.totalPurchasedLast6m.toLocaleString()}원</strong>
                        </div>
                      </div>

                      {/* 등급 설정 컨트롤 */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#cbd5e1" }}>등급 변경</label>
                          <select
                            value={gradeForm.tierId}
                            onChange={(e) => setGradeForm((p) => ({ ...p, tierId: e.target.value }))}
                            style={{
                              width: "100%",
                              height: "45px",
                              padding: "0.5rem 1rem",
                              fontSize: "0.9375rem",
                              color: "#f8fafc",
                              background: "#1e293b",
                              border: "1px solid #475569",
                              borderRadius: "8px",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            {membership.allTiers.map((t) => (
                              <option key={t.id} value={t.id} style={{ background: "#1e293b", color: "#f8fafc" }}>
                                {t.badge_emoji} {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ height: "45px", display: "flex", alignItems: "center" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", fontSize: "0.9375rem", color: "#cbd5e1", userSelect: "none" }}>
                            <input
                              type="checkbox"
                              checked={gradeForm.isLocked}
                              onChange={(e) => setGradeForm((p) => ({ ...p, isLocked: e.target.checked }))}
                              style={{ width: "18px", height: "18px", cursor: "pointer" }}
                            />
                            <strong>등급 잠금 (자동 재산정 제외)</strong>
                          </label>
                        </div>

                        {gradeForm.isLocked && (
                          <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                            <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#cbd5e1" }}>잠금 사유</label>
                            <input
                              type="text"
                              value={gradeForm.lockReason}
                              onChange={(e) => setGradeForm((p) => ({ ...p, lockReason: e.target.value }))}
                              placeholder="예) MOCA 골드 회원 등급 연동"
                              style={{
                                width: "100%",
                                height: "45px",
                                padding: "0.5rem 1rem",
                                fontSize: "0.9375rem",
                                color: "#f8fafc",
                                background: "#1e293b",
                                border: "1px solid #475569",
                                borderRadius: "8px",
                                outline: "none",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* 저장 버튼 */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                        <button
                          onClick={handleSaveGrade}
                          disabled={savingGrade}
                          className="admin-btn admin-btn-primary"
                          style={{
                            padding: "0.625rem 1.25rem",
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            borderRadius: "8px",
                            cursor: "pointer",
                          }}
                        >
                          {savingGrade ? "⏳ 저장 중..." : "💾 등급 저장"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#94a3b8", fontSize: "0.875rem", textAlign: "center", padding: "2rem", background: "rgba(15,23,42,0.4)", borderRadius: 12 }}>
                      ⏳ 등급 정보를 불러오는 중...
                    </div>
                  )}
                </section>

              </div>
            ) : (
              <div style={{ padding: "4rem 0", textAlign: "center", color: "#ef4444" }}>
                ❌ 상세 정보를 불러오는 과정에서 오류가 발생했습니다.
              </div>
            )}
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════
            적립금 수동 조정 모달
      ══════════════════════════════════════════════════════ */}
      {showPointModal && selectedUser && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 60,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setShowPointModal(false)}
        >
          <div
            style={{
              background: "#0f172a", color: "#f8fafc", width: "100%", maxWidth: "420px",
              borderRadius: "16px", padding: "1.5rem", border: "1px solid rgba(236,72,153,0.25)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#ec4899" }}>
                ✏️ 적립금 수동 조정
              </h3>
              <button
                onClick={() => setShowPointModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.4rem", cursor: "pointer" }}
              >✕</button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: "0 0 1rem" }}>
              <strong style={{ color: "#f1f5f9" }}>{selectedUser.name || selectedUser.phone}</strong> 회원의 통합 포인트를 수동으로 지급하거나 차감합니다.
            </p>

            {/* 지급 / 차감 선택 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
              {(["reward", "deduct"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPointForm((p) => ({ ...p, type: t }))}
                  style={{
                    padding: "0.625rem", borderRadius: "10px", fontWeight: 700, fontSize: "0.9rem",
                    cursor: "pointer", transition: "all 0.15s",
                    background: pointForm.type === t ? (t === "reward" ? "rgba(236,72,153,0.25)" : "rgba(239,68,68,0.25)") : "rgba(255,255,255,0.04)",
                    border: pointForm.type === t ? `1px solid ${t === "reward" ? "#ec4899" : "#ef4444"}` : "1px solid rgba(255,255,255,0.08)",
                    color: pointForm.type === t ? (t === "reward" ? "#ec4899" : "#f87171") : "#64748b",
                  }}
                >
                  {t === "reward" ? "🎁 지급 (적립)" : "💸 차감 (회수)"}
                </button>
              ))}
            </div>

            {/* 금액 */}
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: "0.375rem" }}>금액 (P)</label>
              <input
                type="number"
                min="1"
                value={pointForm.amount}
                onChange={(e) => setPointForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="예) 5000"
                style={{
                  width: "100%", padding: "0.625rem 0.875rem", borderRadius: "8px",
                  background: "#1e293b", border: "1px solid #475569", color: "#f8fafc",
                  fontSize: "1rem", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {/* 사유 */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: "0.375rem" }}>사유</label>
              <input
                type="text"
                value={pointForm.description}
                onChange={(e) => setPointForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="예) 이벤트 당첨 적립, 운영자 보상 등"
                style={{
                  width: "100%", padding: "0.625rem 0.875rem", borderRadius: "8px",
                  background: "#1e293b", border: "1px solid #475569", color: "#f8fafc",
                  fontSize: "0.9375rem", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowPointModal(false)}
                style={{
                  padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem",
                  background: "transparent", border: "1px solid #475569", color: "#94a3b8", cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleAdjustPoints}
                disabled={pointSaving}
                style={{
                  padding: "0.625rem 1.25rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.9rem",
                  background: pointForm.type === "reward" ? "#ec4899" : "#ef4444",
                  border: "none", color: "#fff", cursor: pointSaving ? "not-allowed" : "pointer",
                  opacity: pointSaving ? 0.6 : 1,
                }}
              >
                {pointSaving ? "⏳ 처리 중..." : pointForm.type === "reward" ? "✅ 지급하기" : "✅ 차감하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
            쿠폰 수동 발급 모달
      ══════════════════════════════════════════════════════ */}
      {showCouponModal && selectedUser && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 60,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setShowCouponModal(false)}
        >
          <div
            style={{
              background: "#0f172a", color: "#f8fafc", width: "100%", maxWidth: "420px",
              borderRadius: "16px", padding: "1.5rem", border: "1px solid rgba(147,51,234,0.25)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#a855f7" }}>
                🎁 쿠폰 수동 발급
              </h3>
              <button
                onClick={() => setShowCouponModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.4rem", cursor: "pointer" }}
              >✕</button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: "0 0 1rem" }}>
              <strong style={{ color: "#f1f5f9" }}>{selectedUser.name || selectedUser.phone}</strong> 회원에게 쿠폰을 수동으로 발급합니다.
            </p>

            {/* 쿠폰 템플릿 선택 */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: "0.375rem" }}>발급할 쿠폰 선택</label>
              {couponTemplatesLoading ? (
                <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                  ⏳ 쿠폰 목록 불러오는 중...
                </div>
              ) : couponTemplates.length === 0 ? (
                <div style={{
                  padding: "1rem", background: "rgba(147,51,234,0.05)", border: "1px solid rgba(147,51,234,0.15)",
                  borderRadius: "8px", color: "#94a3b8", fontSize: "0.8125rem", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📋</div>
                  <div>등록된 쿠폰 템플릿이 없습니다.</div>
                  <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#64748b" }}>
                    아임모델 공화국 서버에서 쿠폰 템플릿을 먼저 등록해 주세요.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
                  {couponTemplates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      style={{
                        padding: "0.75rem 1rem", borderRadius: "8px", cursor: "pointer", transition: "all 0.15s",
                        background: selectedTemplateId === t.id ? "rgba(147,51,234,0.2)" : "rgba(255,255,255,0.03)",
                        border: selectedTemplateId === t.id ? "1px solid #a855f7" : "1px solid rgba(255,255,255,0.06)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "0.875rem" }}>🏷️ {t.name}</span>
                      <span style={{ fontWeight: 800, color: "#a855f7", fontSize: "0.875rem" }}>
                        {t.discountType === "fixed" ? `${t.discountValue.toLocaleString()}원` : `${t.discountValue}%`} 할인
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCouponModal(false)}
                style={{
                  padding: "0.625rem 1rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem",
                  background: "transparent", border: "1px solid #475569", color: "#94a3b8", cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleIssueCoupon}
                disabled={couponIssuing || !selectedTemplateId || couponTemplates.length === 0}
                style={{
                  padding: "0.625rem 1.25rem", borderRadius: "8px", fontWeight: 700, fontSize: "0.9rem",
                  background: "#a855f7", border: "none", color: "#fff",
                  cursor: (couponIssuing || !selectedTemplateId) ? "not-allowed" : "pointer",
                  opacity: (couponIssuing || !selectedTemplateId) ? 0.5 : 1,
                }}
              >
                {couponIssuing ? "⏳ 발급 중..." : "🎁 쿠폰 발급"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
            솔라피 설정 확인 모달
      ══════════════════════════════════════════════════════ */}
      {showSolapiCheckModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 70,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setShowSolapiCheckModal(false)}
        >
          <div
            style={{
              background: "#0f172a", color: "#f8fafc", width: "100%", maxWidth: "480px",
              borderRadius: "16px", padding: "1.5rem", border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#ec4899" }}>
                ⚙️ 솔라피(Solapi) 연동 설정 확인
              </h3>
              <button
                onClick={() => setShowSolapiCheckModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.4rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            
            {solapiCheckLoading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                ⏳ Vercel 서버 환경 변수 확인 중...
              </div>
            ) : solapiConfig ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0 }}>
                  실서버(Vercel)에 로드된 환경 변수 설정 상태입니다.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "rgba(15,23,42,0.6)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                  {Object.entries(solapiConfig).map(([key, val]: any) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "0.5rem" }}>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{key}</span>
                      <strong style={{ color: val.includes("❌") ? "#ef4444" : "#10b981" }}>
                        {val}
                      </strong>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  * API Secret 등 보안 정보는 길이만 표시되며, 값 자체는 외부에 유출되지 않습니다.
                </p>
              </div>
            ) : (
              <div style={{ color: "#ef4444", fontSize: "0.875rem", textAlign: "center", padding: "1rem" }}>
                설정을 불러오지 못했습니다. 관리자 권한이 만료되었을 수 있으니 다시 시도해 주세요.
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button
                onClick={() => setShowSolapiCheckModal(false)}
                className="admin-btn admin-btn-primary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", borderRadius: "8px" }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

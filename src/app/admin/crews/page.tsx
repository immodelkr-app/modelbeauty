"use client";

import { useState, useEffect, useCallback } from "react";

interface LiveCrew {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  resident_registration_number: string; // Masked from backend
  bank_name: string;
  account_number: string;              // Masked from backend
  default_commission_rate: number;
  created_at: string;
}

export default function AdminCrewsPage() {
  const [crews, setCrews] = useState<LiveCrew[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCrew, setEditingCrew] = useState<LiveCrew | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [residentNumber, setResidentNumber] = useState("");
  const [commissionRate, setCommissionRate] = useState(0);

  // Decrypted values cache for UI display
  const [decryptedValues, setDecryptedValues] = useState<Record<string, { rrn: string; acc: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchCrews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/crews");
      const result = await res.json();
      if (result.success) {
        setCrews(result.data ?? []);
      } else {
        alert(result.error ?? "크루 목록 조회에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("크루 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrews();
  }, [fetchCrews]);

  // Open modal for registration
  const handleOpenRegister = () => {
    setEditingCrew(null);
    setName("");
    setNickname("");
    setPhone("");
    setBankName("");
    setAccountNumber("");
    setResidentNumber("");
    setCommissionRate(0);
    setShowModal(true);
  };

  // Open modal for edit
  const handleOpenEdit = (crew: LiveCrew) => {
    setEditingCrew(crew);
    setName(crew.name);
    setNickname(crew.nickname);
    setPhone(crew.phone);
    setBankName(crew.bank_name);
    // Masked values will show in inputs, but the API will only update if they are changed
    setAccountNumber(crew.account_number);
    setResidentNumber(crew.resident_registration_number);
    setCommissionRate(crew.default_commission_rate);
    setShowModal(true);
  };

  // Submit form (create / update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nickname || !phone || !bankName || !accountNumber || !residentNumber) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingCrew ? `/api/admin/crews/${editingCrew.id}` : "/api/admin/crews";
      const method = editingCrew ? "PUT" : "POST";
      const payload = {
        name,
        nickname,
        phone,
        bankName,
        accountNumber,
        residentRegistrationNumber: residentNumber,
        defaultCommissionRate: commissionRate,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        // Clear cached decrypted values if updating
        if (editingCrew) {
          setDecryptedValues(prev => {
            const next = { ...prev };
            delete next[editingCrew.id];
            return next;
          });
        }
        fetchCrews();
      } else {
        alert(result.error ?? "요청 처리에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle decryption request for a specific crew member
  const handleDecrypt = async (crewId: string) => {
    if (decryptedValues[crewId]) {
      // Toggle back to masked if already decrypted
      setDecryptedValues(prev => {
        const next = { ...prev };
        delete next[crewId];
        return next;
      });
      return;
    }

    const ok = confirm(
      "🔒 민감 정보(주민등록번호 및 계좌번호) 복호화 조회를 진행하시겠습니까?\n조회 내역이 보안 감사 로그에 기록될 수 있습니다."
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/crews/${crewId}/decrypt`, { method: "POST" });
      const result = await res.json();
      if (result.success && result.data) {
        setDecryptedValues(prev => ({
          ...prev,
          [crewId]: {
            rrn: result.data.residentRegistrationNumber,
            acc: result.data.accountNumber,
          },
        }));
      } else {
        alert(result.error ?? "복호화 실패");
      }
    } catch (e) {
      console.error(e);
      alert("복호화 요청 중 네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          크루 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({crews.length}명 등록됨)
          </span>
        </h1>
        <button onClick={handleOpenRegister} className="admin-btn admin-btn-primary">
          ＋ 신규 크루 등록
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
              불러오는 중...
            </div>
          ) : crews.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">👥</div>
              <p className="admin-empty-title">등록된 크루가 없습니다</p>
              <p className="admin-empty-desc">새로운 라이브 크루를 등록해 보세요.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름 (실명)</th>
                  <th>닉네임</th>
                  <th>연락처</th>
                  <th>주민등록번호</th>
                  <th>정산 은행</th>
                  <th>계좌번호</th>
                  <th>기본 정산비율</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {crews.map((crew) => {
                  const isDecrypted = !!decryptedValues[crew.id];
                  const displayRRN = isDecrypted
                    ? decryptedValues[crew.id].rrn
                    : crew.resident_registration_number;
                  const displayAcc = isDecrypted
                    ? decryptedValues[crew.id].acc
                    : crew.account_number;

                  return (
                    <tr key={crew.id}>
                      <td style={{ fontWeight: 600 }}>{crew.name}</td>
                      <td>{crew.nickname}</td>
                      <td className="admin-text-mono">{crew.phone}</td>
                      <td className="admin-text-mono" style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: isDecrypted ? "#ef4444" : "inherit" }}>
                          {displayRRN}
                        </span>
                      </td>
                      <td>{crew.bank_name}</td>
                      <td className="admin-text-mono">
                        <span style={{ color: isDecrypted ? "#ef4444" : "inherit" }}>
                          {displayAcc}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--mb-pink-600)" }}>
                        {crew.default_commission_rate}%
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                        {new Date(crew.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            onClick={() => handleDecrypt(crew.id)}
                            className="admin-btn admin-btn-sm"
                            style={{
                              borderColor: isDecrypted ? "#ef4444" : "#e5e7eb",
                              color: isDecrypted ? "#ef4444" : "#4b5563",
                              backgroundColor: isDecrypted ? "#fef2f2" : "#ffffff",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            {isDecrypted ? "🔒 마스킹" : "🔓 복호화"}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(crew)}
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                          >
                            ✏️ 수정
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 등록 / 수정 모달 */}
      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editingCrew ? "✏️ 크루 정보 수정" : "＋ 신규 크루 등록"}
              </h2>
              <button onClick={() => setShowModal(false)} className="admin-modal-close-btn">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">실명</label>
                    <input
                      className="admin-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="예) 홍길동"
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">닉네임 (활동명)</label>
                    <input
                      className="admin-input"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      required
                      placeholder="예) 쇼호스트 길동"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem" }}>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">연락처</label>
                    <input
                      className="admin-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="예) 010-1234-5678"
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">기본 정산비율 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="admin-input"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                      required
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label className="admin-label admin-label-required">주민등록번호</label>
                  <input
                    className="admin-input"
                    value={residentNumber}
                    onChange={(e) => setResidentNumber(e.target.value)}
                    required
                    placeholder="예) 950101-1234567"
                    disabled={!!editingCrew && residentNumber.includes("*")}
                  />
                  {editingCrew && residentNumber.includes("*") && (
                    <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px" }}>
                      ※ 기존 암호화된 주민번호는 변경 시에만 입력폼을 수정할 수 있습니다. (수정하려면 크루 목록에서 먼저 복호화하여 편집해야 합니다)
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "1rem" }}>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">은행명</label>
                    <input
                      className="admin-input"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      placeholder="예) 신한은행"
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">계좌번호</label>
                    <input
                      className="admin-input"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                      placeholder="예) 110-123-456789"
                      disabled={!!editingCrew && accountNumber.includes("*")}
                    />
                    {editingCrew && accountNumber.includes("*") && (
                      <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "4px" }}>
                        ※ 계좌번호도 기존 마스킹 상태에서는 수정할 수 없습니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "저장 중..." : editingCrew ? "수정 완료" : "크루 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

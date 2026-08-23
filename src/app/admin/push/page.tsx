"use client";
// /admin/push — 앱 푸시 발송 관리

import { useState, useEffect, useCallback } from "react";

interface AdminUserOption {
  masterUserId: string;
  name: string | null;
  realName: string | null;
  phone: string | null;
  email: string | null;
}

interface PushHistoryItem {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  targetType: "all" | "user";
  targetCount: number;
  successCount: number;
  failureCount: number;
  sentBy: string | null;
  createdAt: string;
}

function formatUserLabel(u: AdminUserOption): string {
  const name = u.realName || u.name || "이름 없음";
  return u.phone ? `${name} (${u.phone})` : name;
}

export default function AdminPushPage() {
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [targetType, setTargetType] = useState<"all" | "user">("all");

  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserOption | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<PushHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/push/history");
      const { data, success } = await res.json();
      if (success) setHistory(data ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(({ users: list, success }) => {
        if (success) {
          setUsers(
            (list ?? []).map((u: { masterUserId: string; name: string | null; realName: string | null; phone: string | null; email: string | null }) => ({
              masterUserId: u.masterUserId,
              name: u.name,
              realName: u.realName,
              phone: u.phone,
              email: u.email,
            }))
          );
        }
      });
  }, [fetchHistory]);

  const filteredUsers =
    userSearch.trim().length === 0
      ? []
      : users
          .filter((u) => {
            const q = userSearch.trim();
            return (
              (u.name && u.name.includes(q)) ||
              (u.realName && u.realName.includes(q)) ||
              (u.phone && u.phone.includes(q))
            );
          })
          .slice(0, 8);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !messageBody.trim()) {
      setError("제목과 내용을 입력해주세요.");
      return;
    }
    if (targetType === "user" && !selectedUser) {
      setError("발송할 회원을 선택해주세요.");
      return;
    }

    const confirmMessage =
      targetType === "all"
        ? "전체 앱 사용자에게 푸시를 발송합니다. 되돌릴 수 없습니다. 계속할까요?"
        : `"${formatUserLabel(selectedUser!)}" 님에게 테스트 발송합니다. 계속할까요?`;
    if (!confirm(confirmMessage)) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: messageBody.trim(),
          linkUrl: linkUrl.trim() || null,
          targetType,
          targetMasterUserId: targetType === "user" ? selectedUser!.masterUserId : undefined,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error ?? "발송에 실패했습니다.");
        return;
      }
      alert(
        `발송 완료: 대상 ${result.data.targetCount}건 중 성공 ${result.data.successCount}건, 실패 ${result.data.failureCount}건`
      );
      setTitle("");
      setMessageBody("");
      setLinkUrl("");
      setSelectedUser(null);
      setUserSearch("");
      fetchHistory();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">푸시 관리</h1>
      </div>

      <div className="admin-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>푸시 발송</h2>
        {error && (
          <div className="admin-alert admin-alert-warn" role="alert" style={{ marginBottom: "1rem" }}>
            ⚠️ {error}
          </div>
        )}
        <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="admin-field">
            <label className="admin-label admin-label-required">제목</label>
            <input
              className="admin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 오늘 밤 8시 라이브 방송 알림"
              maxLength={100}
              required
            />
          </div>
          <div className="admin-field">
            <label className="admin-label admin-label-required">내용</label>
            <textarea
              className="admin-textarea"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="알림에 표시될 내용을 입력하세요."
              rows={3}
              maxLength={200}
              required
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">탭 시 이동할 링크 (선택)</label>
            <input
              className="admin-input"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://www.modelbeauty.kr/products/..."
            />
            <p className="admin-input-hint">비워두면 앱 홈으로 이동합니다.</p>
          </div>

          <div className="admin-field">
            <label className="admin-label">발송 대상</label>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="radio" name="targetType" checked={targetType === "all"} onChange={() => setTargetType("all")} />
                <span>전체 발송</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                <input type="radio" name="targetType" checked={targetType === "user"} onChange={() => setTargetType("user")} />
                <span>특정 회원 테스트 발송</span>
              </label>
            </div>
          </div>

          {targetType === "user" && (
            <div className="admin-field" style={{ position: "relative" }}>
              <label className="admin-label">회원 검색</label>
              {selectedUser ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className="admin-badge admin-badge-green">{formatUserLabel(selectedUser)}</span>
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setSelectedUser(null)}>
                    변경
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="admin-input"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="이름 또는 전화번호로 검색..."
                  />
                  {userSearch.trim() && (
                    <div
                      className="admin-card"
                      style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                        marginTop: "0.25rem", padding: "0.5rem", maxHeight: "260px", overflowY: "auto",
                      }}
                    >
                      {filteredUsers.length === 0 ? (
                        <p style={{ fontSize: "0.8125rem", color: "#9ca3af", padding: "0.5rem" }}>검색 결과가 없습니다.</p>
                      ) : (
                        filteredUsers.map((u) => (
                          <button
                            type="button"
                            key={u.masterUserId}
                            onClick={() => { setSelectedUser(u); setUserSearch(""); }}
                            style={{
                              display: "block", width: "100%", padding: "0.5rem", background: "none", border: "none",
                              cursor: "pointer", textAlign: "left", fontSize: "0.875rem", borderRadius: "6px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            {formatUserLabel(u)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
              {sending ? "발송 중..." : "발송"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div style={{ padding: "1.5rem 1.5rem 0" }}>
          <h2 className="admin-card-title">발송 이력</h2>
        </div>
        <div className="admin-table-wrap">
          {historyLoading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🔔</div>
              <p className="admin-empty-title">발송 이력이 없습니다</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>대상</th>
                  <th>성공/실패</th>
                  <th>발송자</th>
                  <th>발송일시</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{h.title}</div>
                      <div style={{ fontSize: "0.75rem", color: "#9ca3af", maxWidth: "320px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {h.body}
                      </div>
                    </td>
                    <td>{h.targetType === "all" ? `전체 (${h.targetCount})` : "특정 회원"}</td>
                    <td>
                      <span style={{ color: "#16a34a" }}>{h.successCount}</span>
                      {" / "}
                      <span style={{ color: h.failureCount > 0 ? "#ef4444" : "#9ca3af" }}>{h.failureCount}</span>
                    </td>
                    <td>{h.sentBy ?? "-"}</td>
                    <td className="admin-text-mono">{new Date(h.createdAt).toLocaleString("ko-KR")}</td>
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

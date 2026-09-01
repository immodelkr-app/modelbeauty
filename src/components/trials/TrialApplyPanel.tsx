"use client";
// ============================================================
// TrialApplyPanel — 체험단 신청 버튼 + 모달 (Client Component)
// ============================================================

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";

interface TrialApplyPanelProps {
  campaignId: string;
  isClosed: boolean;
  initialApplied: boolean;
}

export default function TrialApplyPanel({ campaignId, isClosed, initialApplied }: TrialApplyPanelProps) {
  const { isLoggedIn } = useAuthStore();
  const [applied, setApplied] = useState(initialApplied);
  const [open, setOpen] = useState(false);
  const [channelUrl, setChannelUrl] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    if (!isLoggedIn) {
      alert("로그인 후 신청할 수 있어요.");
      return;
    }
    setChannelUrl("");
    setMessage("");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!channelUrl.trim()) {
      alert("블로그/유튜브/인스타 링크를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trials/${campaignId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: channelUrl.trim(), message: message.trim() || undefined }),
      });
      const result = await res.json();
      if (result.success) {
        alert("신청이 완료되었습니다. 선정 결과는 앱 알림/문자로 안내드려요.");
        setApplied(true);
        setOpen(false);
      } else {
        alert(result.error ?? "신청에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={applied || isClosed}
        style={{
          width: "100%",
          padding: "0.9rem",
          border: "none",
          borderRadius: "12px",
          fontSize: "1rem",
          fontWeight: 800,
          cursor: applied || isClosed ? "default" : "pointer",
          background: applied || isClosed ? "var(--mb-gray-100)" : "var(--mb-pink-600)",
          color: applied || isClosed ? "var(--mb-gray-500)" : "#fff",
        }}
      >
        {applied ? "✅ 신청 완료" : isClosed ? "모집 마감" : "체험단 신청하기"}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: 420 }}
          >
            <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 800 }}>체험단 신청</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
              선정 결과는 앱 알림/문자로 안내드려요. 참가비가 있는 캠페인은 선정된 분에게만 결제를 요청합니다.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>블로그·유튜브·인스타 링크</div>
              <input
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", padding: "0.65rem 0.75rem", fontSize: "0.875rem" }}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                지원 동기 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택)</span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="간단히 소개해주세요."
                style={{ width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", padding: "0.75rem", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setOpen(false)}
                style={{ flex: 1, padding: "0.75rem", border: "1px solid var(--mb-gray-200)", background: "#fff", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 2, padding: "0.75rem", border: "none", background: "var(--mb-pink-600)", color: "#fff", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "신청 중..." : "신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

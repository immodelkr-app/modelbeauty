"use client";
// ============================================================
// TrialsGrid — 체험단 캠페인 카드 목록 + 신청 모달 (Client Component)
// ============================================================

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/auth.store";
import type { TrialCampaign } from "@/types";

interface TrialsGridProps {
  campaigns: TrialCampaign[];
  initialMyApplications: string[];
}

function formatDday(recruitEnd: string): string {
  const diffDays = Math.ceil((new Date(recruitEnd).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "마감";
  if (diffDays === 0) return "오늘 마감";
  return `D-${diffDays}`;
}

export default function TrialsGrid({ campaigns, initialMyApplications }: TrialsGridProps) {
  const { isLoggedIn } = useAuthStore();
  const [myApplications, setMyApplications] = useState(new Set(initialMyApplications));
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);
  const [channelUrl, setChannelUrl] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openApply = (campaignId: string) => {
    if (!isLoggedIn) {
      alert("로그인 후 신청할 수 있어요.");
      return;
    }
    setChannelUrl("");
    setMessage("");
    setOpenCampaignId(campaignId);
  };

  const handleSubmit = async () => {
    if (!openCampaignId) return;
    if (!channelUrl.trim()) {
      alert("블로그/유튜브/인스타 링크를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trials/${openCampaignId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: channelUrl.trim(), message: message.trim() || undefined }),
      });
      const result = await res.json();
      if (result.success) {
        alert("신청이 완료되었습니다. 선정 결과는 앱 알림/문자로 안내드려요.");
        setMyApplications((prev) => new Set(prev).add(openCampaignId));
        setOpenCampaignId(null);
      } else {
        alert(result.error ?? "신청에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (campaigns.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--mb-gray-400)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎁</div>
        <p style={{ fontWeight: 600, color: "var(--mb-gray-600)" }}>지금 모집 중인 체험단이 없어요</p>
        <p style={{ fontSize: "0.875rem" }}>새로운 체험단이 열리면 이 페이지에서 바로 만나보실 수 있어요.</p>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {campaigns.map((c) => {
          const thumbnail = c.product.images?.[0]?.url ?? null;
          const applied = myApplications.has(c.id);
          const dday = formatDday(c.recruitEnd);
          const isClosed = c.status !== "recruiting" || dday === "마감";

          return (
            <div
              key={c.id}
              style={{
                border: "1px solid var(--mb-gray-200)",
                borderRadius: "16px",
                overflow: "hidden",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Link href={`/products/${c.product.slug}`} style={{ position: "relative", display: "block", aspectRatio: "1/1", background: "var(--mb-gray-50)" }}>
                {thumbnail ? (
                  <Image src={thumbnail} alt={c.product.name} fill sizes="(max-width: 768px) 100vw, 30vw" style={{ objectFit: "cover" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "2rem" }}>✨</div>
                )}
                <span
                  style={{
                    position: "absolute", top: "0.75rem", left: "0.75rem",
                    fontSize: "0.7rem", fontWeight: 800, padding: "0.25rem 0.6rem", borderRadius: "999px",
                    background: c.campaignType === "free" ? "var(--mb-pink-600)" : "#191919",
                    color: "#fff",
                  }}
                >
                  {c.campaignType === "free" ? "무료 체험단" : `참가비 ${c.price.toLocaleString()}원`}
                </span>
                <span
                  style={{
                    position: "absolute", top: "0.75rem", right: "0.75rem",
                    fontSize: "0.7rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: "999px",
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                  }}
                >
                  {dday}
                </span>
              </Link>

              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--mb-gray-500)" }}>{c.product.name}</p>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--mb-gray-900)" }}>{c.title}</h3>
                {c.description && (
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--mb-gray-600)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {c.description}
                  </p>
                )}
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--mb-gray-400)" }}>
                  모집 정원 {c.quota}명 · 신청 {c.applicantCount}명
                </p>

                <button
                  onClick={() => openApply(c.id)}
                  disabled={applied || isClosed}
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.7rem",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    cursor: applied || isClosed ? "default" : "pointer",
                    background: applied ? "var(--mb-gray-100)" : isClosed ? "var(--mb-gray-100)" : "var(--mb-pink-600)",
                    color: applied || isClosed ? "var(--mb-gray-500)" : "#fff",
                  }}
                >
                  {applied ? "✅ 신청 완료" : isClosed ? "모집 마감" : "체험단 신청하기"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 신청 모달 */}
      {openCampaignId && (
        <div
          onClick={() => setOpenCampaignId(null)}
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
                onClick={() => setOpenCampaignId(null)}
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

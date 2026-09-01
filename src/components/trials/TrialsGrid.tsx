"use client";
// ============================================================
// TrialsGrid — 체험단 캠페인 카드 목록 (Client Component)
// 카드를 누르면 상세페이지(/trials/[id])로 이동해서 신청한다.
// ============================================================

import Link from "next/link";
import Image from "next/image";
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
  const myApplications = new Set(initialMyApplications);

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
          <Link
            key={c.id}
            href={`/trials/${c.id}`}
            style={{
              border: "1px solid var(--mb-gray-200)",
              borderRadius: "16px",
              overflow: "hidden",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <div style={{ position: "relative", aspectRatio: "1/1", background: "var(--mb-gray-50)" }}>
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
              {applied && (
                <span
                  style={{
                    position: "absolute", bottom: "0.75rem", left: "0.75rem",
                    fontSize: "0.7rem", fontWeight: 800, padding: "0.25rem 0.6rem", borderRadius: "999px",
                    background: "#fff", color: "var(--mb-pink-600)",
                  }}
                >
                  ✅ 신청 완료
                </span>
              )}
            </div>

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
            </div>
          </Link>
        );
      })}
    </div>
  );
}

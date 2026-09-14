"use client";

// ============================================================
// 편성표 썸네일에 올라가는 실시간 카운트다운 배지
// (라이브 상세 대기화면의 countdown 로직과 동일한 방식, 썸네일용 축약 표시)
// ============================================================

import { useEffect, useState } from "react";

interface Props {
  scheduledAt: string;
  className?: string;
}

function formatRemaining(scheduledAt: string): string | null {
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  if (days > 0) {
    return `${days}일 ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function LiveCountdownBadge({ scheduledAt, className }: Props) {
  const [label, setLabel] = useState<string | null>(() => formatRemaining(scheduledAt));

  useEffect(() => {
    const tick = () => setLabel(formatRemaining(scheduledAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [scheduledAt]);

  if (!label) {
    return <span className={className}>🔴 곧 시작</span>;
  }
  return <span className={className}>⏳ {label} 후</span>;
}

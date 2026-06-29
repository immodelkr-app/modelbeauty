"use client";

// ============================================================
// TrackingTimeline — 배송 추적 타임라인 컴포넌트
// ============================================================

import { useState, useCallback } from "react";
import { TRACKING_LEVELS, formatTrackingTime, type TrackingInfo } from "@/lib/sweettracker";

interface TrackingTimelineProps {
  carrierCode: string;
  carrierName: string;
  trackingNumber: string;
  orderId?: string;
  /** 이미 로드된 데이터가 있으면 초기값으로 사용 */
  initialData?: TrackingInfo | null;
}

// ── 진행 단계 스테퍼 ─────────────────────────────────────────

const STEPS = [
  { level: 1, label: "배송준비" },
  { level: 2, label: "집화완료" },
  { level: 3, label: "배송중" },
  { level: 4, label: "지점도착" },
  { level: 5, label: "배송출발" },
  { level: 6, label: "배송완료" },
];

function ProgressStepper({ level }: { level: number }) {
  return (
    <div className="tracking-stepper">
      {STEPS.map((step, idx) => {
        const done = level >= step.level;
        const current = level === step.level;
        return (
          <div key={step.level} className="tracking-step-wrap">
            {/* 연결선 */}
            {idx > 0 && (
              <div
                className="tracking-step-line"
                style={{ background: done ? "var(--mb-gradient)" : "#e5e7eb" }}
              />
            )}
            <div className="tracking-step-col">
              <div
                className={`tracking-step-dot${done ? " done" : ""}${current ? " current" : ""}`}
              >
                {done ? (
                  level === 6 && step.level === 6 ? "✓" : step.level
                ) : (
                  step.level
                )}
              </div>
              <span
                className="tracking-step-label"
                style={{ color: done ? "var(--mb-pink-600)" : "#9ca3af", fontWeight: current ? 700 : 400 }}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function TrackingTimeline({
  carrierCode,
  carrierName,
  trackingNumber,
  orderId,
  initialData,
}: TrackingTimelineProps) {
  const [data, setData] = useState<TrackingInfo | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ carrierCode, trackingNumber });
    if (orderId) qs.set("orderId", orderId);

    const res = await fetch(`/api/tracking?${qs}`);
    const result = await res.json();

    if (!result.success) {
      setError(result.error ?? "배송 조회에 실패했습니다.");
    } else {
      setData(result.data);
      setExpanded(true);
    }
    setLoading(false);
  }, [carrierCode, trackingNumber, orderId]);

  const currentLevel = data?.level ?? 0;
  const levelInfo = TRACKING_LEVELS[currentLevel];
  const isComplete = data?.complete ?? false;

  return (
    <div className="tracking-card">
      {/* 헤더 */}
      <div className="tracking-card-header">
        <div>
          <div className="tracking-carrier">{carrierName}</div>
          <div className="tracking-number">{trackingNumber}</div>
        </div>
        {data && (
          <span
            className={`tracking-status-badge${isComplete ? " complete" : ""}`}
          >
            {levelInfo?.icon} {levelInfo?.label ?? "조회중"}
          </span>
        )}
      </div>

      {/* 진행 단계 */}
      {data && <ProgressStepper level={currentLevel} />}

      {/* 오류 */}
      {error && (
        <div className="tracking-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* 최근 배송 이벤트 (접힘/펼침) */}
      {data && data.trackingDetails?.length > 0 && (
        <div>
          <div className="tracking-timeline">
            {(expanded ? data.trackingDetails : data.trackingDetails.slice(-3))
              .slice()
              .reverse()
              .map((detail, idx) => {
                const lvl = TRACKING_LEVELS[detail.level];
                const isLatest = idx === 0;
                return (
                  <div
                    key={`${detail.timeString}-${idx}`}
                    className={`tracking-event${isLatest ? " latest" : ""}`}
                  >
                    {/* 타임라인 왼쪽 점 */}
                    <div className="tracking-event-dot-wrap">
                      <div
                        className={`tracking-event-dot${isLatest ? " latest" : ""}`}
                        aria-hidden="true"
                      >
                        {isLatest ? (lvl?.icon ?? "•") : ""}
                      </div>
                      {idx < (expanded ? data.trackingDetails.length : Math.min(3, data.trackingDetails.length)) - 1 && (
                        <div className="tracking-event-line" />
                      )}
                    </div>
                    {/* 내용 */}
                    <div className="tracking-event-body">
                      <div className="tracking-event-kind">{detail.kind}</div>
                      <div className="tracking-event-where">{detail.where}</div>
                      {detail.remark && (
                        <div className="tracking-event-remark">{detail.remark}</div>
                      )}
                      {detail.manName && (
                        <div className="tracking-event-man">
                          🧑 {detail.manName}
                          {detail.telno2 && (
                            <a href={`tel:${detail.telno2}`} className="tracking-tel">
                              {detail.telno2}
                            </a>
                          )}
                        </div>
                      )}
                      <div className="tracking-event-time">
                        {formatTrackingTime(detail.timeString)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* 더 보기 / 접기 */}
          {data.trackingDetails.length > 3 && (
            <button
              className="tracking-expand-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? "▲ 접기"
                : `▼ 전체 보기 (${data.trackingDetails.length}건)`}
            </button>
          )}
        </div>
      )}

      {/* 조회 버튼 */}
      <button
        className="tracking-refresh-btn"
        onClick={fetchTracking}
        disabled={loading}
      >
        {loading ? "조회 중..." : data ? "🔄 새로고침" : "🔍 배송 조회하기"}
      </button>
    </div>
  );
}

"use client";

// ============================================================
// HeroVideoCard — 홈 히어로 우측 라이브/리플레이 영상 카드
// 현재 방송 중: stream_url(IVS HLS) 자동 재생
// 방송 없음:   replay_url 자동 재생
// 둘 다 없음:  커버 이미지 표시
// ============================================================

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface HeroVideoCardProps {
  // 현재 라이브 방송 정보 (없으면 null)
  activeStream: {
    id: string;
    title: string;
    streamerName: string;
    coverImageUrl: string | null;
    streamUrl: string | null;
    viewerCount: number;
  } | null;
  // 최근 종료된 방송 정보 (activeStream이 null일 때 사용)
  lastStream: {
    id: string;
    title: string;
    streamerName: string;
    coverImageUrl: string | null;
    replayUrl: string | null;
  } | null;
}

export default function HeroVideoCard({ activeStream, lastStream }: HeroVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  // 어떤 방송을 보여줄지 결정
  const isLive = !!activeStream;
  const displayStream = activeStream ?? lastStream;
  const videoUrl = activeStream?.streamUrl ?? lastStream?.replayUrl ?? null;
  const coverImg = displayStream?.coverImageUrl ?? null;
  const streamId = displayStream?.id ?? null;
  const streamTitle = displayStream?.title ?? "벨벳 립스틱 전색상 단독 특가 쇼!";
  const streamerName = displayStream?.streamerName ?? "스트리머 지아(Jia)의";
  const viewerCount = activeStream?.viewerCount ?? null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    setVideoError(false);

    // IVS HLS(.m3u8) 스트림은 hls.js 없이도 Safari/iOS에서는 네이티브 지원
    // Chrome/Firefox에서는 .m3u8 직접 재생이 안 되므로 mp4 fallback 처리
    const isHls = videoUrl.includes(".m3u8");

    if (isHls) {
      // hls.js 동적 임포트 (없으면 커버 이미지로 fallback)
      import("hls.js")
        .then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            const hls = new Hls({ autoStartLoad: true });
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.muted = true;
              video.play().catch(() => setVideoError(true));
            });
            hls.on(Hls.Events.ERROR, () => setVideoError(true));
            return () => hls.destroy();
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            // Safari 네이티브 HLS 지원
            video.src = videoUrl;
            video.muted = true;
            video.play().catch(() => setVideoError(true));
          } else {
            setVideoError(true);
          }
        })
        .catch(() => setVideoError(true));
    } else {
      // MP4 등 일반 영상
      video.src = videoUrl;
      video.muted = true;
      video.play().catch(() => setVideoError(true));
    }
  }, [videoUrl]);

  const showVideo = videoUrl && !videoError;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "32px", overflow: "hidden" }}>
      {/* 영상 or 커버 이미지 */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop={!isLive}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setVideoError(true)}
        />
      ) : (
        <Image
          src={coverImg || "/images/live_cover_makeup.png"}
          alt={streamTitle}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          style={{ objectFit: "cover" }}
          priority
        />
      )}

      {/* 그라데이션 오버레이 */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)",
        pointerEvents: "none"
      }} />

      {/* 상태 배지 + 시청자 수 */}
      <div style={{
        position: "absolute",
        top: "1.25rem",
        left: "1.25rem",
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        zIndex: 10
      }}>
        <span style={{
          background: isLive ? "#ef4444" : "var(--mb-pink-500)",
          color: "#fff",
          fontSize: "0.6875rem",
          fontWeight: 800,
          padding: "0.3125rem 0.75rem",
          borderRadius: "100px",
          letterSpacing: "0.08em"
        }}>
          {isLive ? "ON AIR" : lastStream ? "REPLAY" : "LIVE"}
        </span>
        {isLive && viewerCount !== null && (
          <span style={{
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "0.25rem 0.625rem",
            borderRadius: "100px",
            backdropFilter: "blur(4px)"
          }}>
            👤 {viewerCount.toLocaleString()}명
          </span>
        )}
      </div>

      {/* 중앙 플레이 버튼 (영상 없을 때만 표시) */}
      {!showVideo && (
        <Link
          href={streamId ? `/live/${streamId}` : "/live"}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isLive ? "#ef4444" : "var(--mb-pink-500)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 10,
          }}
          aria-label="라이브 보러가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </Link>
      )}

      {/* 방송 제목 텍스트 */}
      <div style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "1.5rem",
        right: "1.5rem",
        color: "#fff",
        zIndex: 10
      }}>
        <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)", marginBottom: "0.25rem" }}>
          {streamerName ? `스트리머 ${streamerName}의` : "스트리머 지아(Jia)의"}
        </p>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.3, margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
          {streamTitle}
        </h3>
      </div>
    </div>
  );
}

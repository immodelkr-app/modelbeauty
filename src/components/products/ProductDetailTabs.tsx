"use client";

// ============================================================
// ProductDetailTabs — 상품 상세 정보 / 라이브 영상 탭 스위처 (Client Component)
// ============================================================

import { useState } from "react";
import Image from "next/image";

interface ProductVideo {
  id: string;
  productId: string;
  streamId: string | null;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  sourceType: "live_replay" | "manual";
  durationSec: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface ProductDetailTabsProps {
  content: string | null;
  videos: ProductVideo[];
}

function getEmbedUrl(url: string): { type: "youtube" | "vimeo" | "direct"; url: string } {
  if (!url) return { type: "direct", url: "" };

  // YouTube url matches (including shorts, embeds, and standard watch URLs)
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: "youtube", url: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo url matches
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: "vimeo", url: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { type: "direct", url };
}

export default function ProductDetailTabs({ content, videos }: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "video">("detail");
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // 비디오 재생 레이아웃 오버레이 열기
  const handlePlayVideo = (url: string) => {
    setActiveVideoUrl(url);
  };

  const hasVideos = videos.length > 0;
  const embed = getEmbedUrl(activeVideoUrl || "");

  return (
    <div className="product-content-section" style={{ marginTop: "3rem" }}>
      {/* 탭 헤더 */}
      <div className="product-content-tabs" style={{ display: "flex", borderBottom: "1px solid var(--mb-gray-200)", marginBottom: "2rem" }}>
        <button
          onClick={() => setActiveTab("detail")}
          className={`product-content-tab${activeTab === "detail" ? " active" : ""}`}
          style={{
            padding: "1rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 700,
            border: "none",
            background: "none",
            cursor: "pointer",
            borderBottom: activeTab === "detail" ? "2px solid var(--mb-pink-600)" : "2px solid transparent",
            color: activeTab === "detail" ? "var(--mb-pink-600)" : "var(--mb-gray-500)",
          }}
        >
          상세 설명
        </button>

        {hasVideos && (
          <button
            onClick={() => setActiveTab("video")}
            className={`product-content-tab${activeTab === "video" ? " active" : ""}`}
            style={{
              padding: "1rem 1.5rem",
              fontSize: "1rem",
              fontWeight: 700,
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: activeTab === "video" ? "2px solid var(--mb-pink-600)" : "2px solid transparent",
              color: activeTab === "video" ? "var(--mb-pink-600)" : "var(--mb-gray-500)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            📺 라이브 영상
            <span
              style={{
                fontSize: "0.6875rem",
                background: "var(--mb-pink-100)",
                color: "var(--mb-pink-600)",
                padding: "2px 6px",
                borderRadius: "100px",
                fontWeight: 800,
              }}
            >
              {videos.length}
            </span>
          </button>
        )}
      </div>

      {/* 탭 바디 */}
      <div className="product-content-body">
        {activeTab === "detail" && (
          <div
            className="product-detail-html"
            dangerouslySetInnerHTML={{ __html: content || "<p style='color: var(--mb-gray-400)'>등록된 상세 정보가 없습니다.</p>" }}
          />
        )}

        {activeTab === "video" && hasVideos && (
          <div>
            {/* 활성 재생 플레이어 오버레이 */}
            {activeVideoUrl && (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  background: "#000",
                  borderRadius: "16px",
                  overflow: "hidden",
                  marginBottom: "2rem",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {embed.type !== "direct" ? (
                  <iframe
                    src={embed.url}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <video
                    src={activeVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                )}
                <button
                  onClick={() => setActiveVideoUrl(null)}
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* 영상 카드 목록 */}
            <div className="product-video-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {videos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => handlePlayVideo(video.videoUrl)}
                  className="prod-video-card"
                  style={{
                    border: "1px solid var(--mb-gray-200)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#fff",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                >
                  {/* 썸네일 */}
                  <div style={{ position: "relative", aspectRatio: "16/9", background: "var(--mb-gray-900)" }}>
                    {video.thumbnailUrl ? (
                      <Image
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 30vw"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2rem",
                        }}
                      >
                        🎬
                      </div>
                    )}
                    
                    {/* 재생 버튼 아이콘 */}
                    <div
                      className="play-overlay"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.9,
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: "var(--mb-pink-500)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "1.2rem",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        ▶
                      </div>
                    </div>
                  </div>

                  {/* 정보 */}
                  <div style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      {video.sourceType === "live_replay" ? (
                        <span
                          style={{
                            background: "var(--mb-pink-50)",
                            color: "var(--mb-pink-600)",
                            fontSize: "0.6875rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 800,
                          }}
                        >
                          🔴 LIVE 다시보기
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "var(--mb-gray-100)",
                            color: "var(--mb-gray-600)",
                            fontSize: "0.6875rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 800,
                          }}
                        >
                          소개 영상
                        </span>
                      )}
                    </div>
                    <h4
                      style={{
                        fontSize: "0.9375rem",
                        fontWeight: 700,
                        color: "var(--mb-gray-900)",
                        margin: 0,
                        lineHeight: 1.4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {video.title}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .prod-video-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}

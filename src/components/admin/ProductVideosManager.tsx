"use client";

// ============================================================
// ProductVideosManager — 상품 수정 화면용 영상 관리 컴포넌트
// ============================================================

import { useState, useEffect, useCallback } from "react";
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

interface ProductVideosManagerProps {
  productId: string;
}

export default function ProductVideosManager({ productId }: ProductVideosManagerProps) {
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // 등록 폼 상태
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  // 로드
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      // 관리자 API로 상품 비디오 전체 조회 (비활성된 것도 포함하여 조회하기 위해 requireAdmin을 거치는 api 호출)
      const res = await fetch(`/api/products/${productId}/videos`);
      const { data, success } = await res.json();
      if (success) {
        setVideos(data ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // 영상 등록
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !videoUrl) {
      alert("제목과 영상 URL은 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          videoUrl,
          thumbnailUrl: thumbnailUrl || null,
          sortOrder: parseInt(sortOrder, 10) || 0,
        }),
      });

      const { success, error } = await res.json();
      if (success) {
        setTitle("");
        setVideoUrl("");
        setThumbnailUrl("");
        setSortOrder("0");
        fetchVideos();
      } else {
        alert(error ?? "영상 등록에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 영상 상태 업데이트 (활성화 토글 또는 정보 편집)
  const handleUpdateVideo = async (videoId: string, payload: Partial<ProductVideo>) => {
    try {
      const res = await fetch(`/api/products/${productId}/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const { success, error } = await res.json();
      if (success) {
        fetchVideos();
      } else {
        alert(error ?? "수정에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("수정 오류 발생");
    }
  };

  // 영상 삭제
  const handleDeleteVideo = async (videoId: string, title: string) => {
    if (!confirm(`"${title}" 영상을 정말로 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/products/${productId}/videos/${videoId}`, {
        method: "DELETE",
      });

      const { success, error } = await res.json();
      if (success) {
        fetchVideos();
      } else {
        alert(error ?? "삭제에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("삭제 오류 발생");
    }
  };

  return (
    <div className="video-manager-section" style={{ marginTop: "2rem" }}>
      <div className="admin-card" style={{ padding: "1.5rem" }}>
        <h2 className="admin-card-title" style={{ marginBottom: "1.25rem" }}>
          📹 상품 영상 관리
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "1.5rem" }}>
          이 상품에 연결된 라이브 다시보기 영상 및 소개 영상 목록입니다. 고객 상세페이지 하단에 노출됩니다.
        </p>

        {/* 영상 등록 폼 */}
        <form onSubmit={handleAddVideo} className="admin-form" style={{ background: "#f9fafb", padding: "1rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: "1rem", alignItems: "end" }}>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label admin-label-required" style={{ fontSize: "0.75rem" }}>영상 제목</label>
              <input
                className="admin-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="예) 수분 진정 크림 5분 하이라이트"
                style={{ padding: "0.5rem" }}
              />
            </div>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label admin-label-required" style={{ fontSize: "0.75rem" }}>영상 주소(Vimeo/유튜브/R2 등)</label>
              <input
                className="admin-input"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
                placeholder="https://vimeo.com/..."
                style={{ padding: "0.5rem" }}
              />
            </div>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>노출 순서</label>
              <input
                type="number"
                className="admin-input"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{ padding: "0.5rem" }}
              />
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: "1rem", alignItems: "end", marginTop: "1rem" }}>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label" style={{ fontSize: "0.75rem" }}>썸네일 이미지 주소 (선택)</label>
              <input
                className="admin-input"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumb.jpg"
                style={{ padding: "0.5rem" }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn admin-btn-primary"
              style={{ width: "100%", height: "38px" }}
            >
              영상 추가
            </button>
          </div>
        </form>

        {/* 영상 리스트 */}
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>
        ) : videos.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: "10px", fontSize: "0.875rem" }}>
            등록된 상품 영상이 없습니다.
          </div>
        ) : (
          <div className="video-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {videos.map((video) => (
              <div
                key={video.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  background: video.isActive ? "#fff" : "#f3f4f6",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: "80px",
                      height: "45px",
                      background: "#374151",
                      borderRadius: "4px",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#9ca3af",
                      fontSize: "0.65rem",
                    }}
                  >
                    {video.thumbnailUrl ? (
                      <Image
                        src={video.thumbnailUrl}
                        alt={video.title}
                        fill
                        sizes="80px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      "VIDEO"
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, color: video.isActive ? "#111827" : "#9ca3af" }}>
                        {video.title}
                      </span>
                      {video.sourceType === "live_replay" ? (
                        <span
                          style={{
                            background: "#ffe4e6",
                            color: "#e11d48",
                            fontSize: "0.6875rem",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          🔴 라이브 원본
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#e0f2fe",
                            color: "#0369a1",
                            fontSize: "0.6875rem",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 700,
                          }}
                        >
                          📹 수동 업로드
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af",
                        wordBreak: "break-all",
                        marginTop: "4px",
                        maxWidth: "350px",
                      }}
                    >
                      URL: {video.videoUrl}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.8125rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={video.isActive}
                      onChange={(e) => handleUpdateVideo(video.id, { isActive: e.target.checked })}
                    />
                    노출 활성
                  </label>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => {
                        const newUrl = prompt("새 영상 주소를 입력하세요:", video.videoUrl);
                        if (newUrl) handleUpdateVideo(video.id, { videoUrl: newUrl });
                      }}
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    >
                      링크 수정
                    </button>
                    <button
                      onClick={() => handleDeleteVideo(video.id, video.title)}
                      className="admin-btn admin-btn-sm"
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        background: "#fee2e2",
                        color: "#ef4444",
                        borderColor: "#fecaca",
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

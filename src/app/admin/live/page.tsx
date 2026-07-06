"use client";

// ============================================================
// /admin/live — 라이브 방송 관리 대시보드
// ============================================================

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface LiveStreamRow {
  id: string;
  title: string;
  description: string | null;
  streamerName: string;
  status: "upcoming" | "live" | "ended";
  coverImageUrl: string | null;
  streamUrl: string | null;
  replayUrl: string | null;
  viewerCount: number;
  createdAt: string;
  startedAt: string | null;
  scheduledAt: string | null;
  products: { id: string; name: string }[];
}

interface ProductOption {
  id: string;
  name: string;
}

interface CrewOption {
  id: string;
  nickname: string;
  ivs_playback_url: string | null;
}

export default function AdminLivePage() {
  const [streams, setStreams] = useState<LiveStreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 폼 상태
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [streamerName, setStreamerName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // 크루 선택
  const [allCrews, setAllCrews] = useState<CrewOption[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string>("");

  // 전체 상품 옵션 리스트
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/live?status=all");
      const { data, success } = await res.json();
      if (success) {
        setStreams(data ?? []);
        setSelectedIds([]); // 로드 성공 시 선택 상태 초기화
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products?limit=100");
      const { data, success } = await res.json();
      if (success && data?.products) {
        setAllProducts(
          data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchCrews = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/crews");
      const { data, success } = await res.json();
      if (success) {
        setAllCrews(
          (data ?? []).map((c: any) => ({
            id: c.id,
            nickname: c.nickname,
            ivs_playback_url: c.ivs_playback_url ?? null,
          }))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    fetchProducts();
    fetchCrews();
  }, [fetchStreams, fetchProducts, fetchCrews]);

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const isConfirmed = confirm(
      `선택한 ${selectedIds.length}개의 라이브 방송을 완전히 삭제하시겠습니까?\n삭제된 방송의 채팅 내역 및 상품 매핑 정보는 즉시 함께 영구 삭제됩니다.`
    );
    if (!isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/live", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const result = await res.json();
      if (result.success) {
        alert("선택한 방송이 삭제되었습니다.");
        fetchStreams();
      } else {
        alert(result.error ?? "삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("삭제 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCrewSelect = (crewId: string) => {
    setSelectedCrewId(crewId);
    if (!crewId) return;
    const crew = allCrews.find((c) => c.id === crewId);
    if (crew) {
      setStreamerName(crew.nickname);
      if (crew.ivs_playback_url) {
        setStreamUrl(crew.ivs_playback_url);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !streamerName) {
      alert("제목과 스트리머 이름은 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          streamerName,
          coverImageUrl: coverImageUrl || null,
          streamUrl: streamUrl || null,
          replayUrl: replayUrl || null,
          scheduledAt: scheduledAt || null,
          productIds: selectedProductIds,
          crewId: selectedCrewId || null,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        // 폼 리셋
        setTitle("");
        setDescription("");
        setStreamerName("");
        setCoverImageUrl("");
        setStreamUrl("");
        setReplayUrl("");
        setScheduledAt("");
        setSelectedProductIds([]);
        setSelectedCrewId("");
        fetchStreams();
        // 크루 선택 없이 새 IVS 채널 발급 실패 시 안내 메시지
        if (!result.data?.ivsAutoCreated && !streamUrl && !selectedCrewId) {
          alert(
            "✅ 방송이 등록되었습니다.\n\n⚠️ AWS IVS 채널 자동 발급은 실패하였습니다.\n" +
            "크루 전용 채널 사용 시에는 방송 등록 시 크루를 선택해 주세요."
          );
        }
      } else {
        alert(result.error ?? "생성에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductToggle = (prodId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
    );
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "live":
        return <span className="admin-status-badge live-badge">🔴 ON AIR</span>;
      case "upcoming":
        return <span className="admin-status-badge upcoming-badge">⏳ 대기중</span>;
      case "ended":
        return <span className="admin-status-badge ended-badge">🎬 종료됨</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          라이브커머스 관리{" "}
          <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#9ca3af" }}>
            ({streams.length}개 방송)
          </span>
        </h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="admin-btn"
              disabled={submitting}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                fontWeight: 700,
              }}
            >
              🗑️ 선택 삭제 ({selectedIds.length}개)
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="admin-btn admin-btn-primary"
          >
            ＋ 라이브 방송 등록
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
              불러오는 중...
            </div>
          ) : streams.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎥</div>
              <p className="admin-empty-title">등록된 라이브 방송이 없습니다</p>
              <p className="admin-empty-desc">새 라이브커머스를 등록해 보세요.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={streams.length > 0 && selectedIds.length === streams.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(streams.map((s) => s.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th>방송 커버</th>
                  <th>방송 정보</th>
                  <th>스트리머</th>
                  <th>상태</th>
                  <th>연결 상품</th>
                  <th>생성일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {streams.map((stream) => (
                  <tr key={stream.id}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(stream.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, stream.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== stream.id));
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td>
                      <div className="admin-table-thumb" style={{ width: "80px", height: "45px", position: "relative" }}>
                        {stream.coverImageUrl ? (
                          <Image
                            src={stream.coverImageUrl}
                            alt={stream.title}
                            fill
                            sizes="80px"
                            style={{ objectFit: "cover", borderRadius: "4px" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: "#374151",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              color: "#9ca3af",
                            }}
                          >
                            NO IMG
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          {stream.title}
                        </div>
                        {stream.description && (
                          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "2px" }}>
                            {stream.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{stream.streamerName}</div>
                    </td>
                    <td>{formatStatus(stream.status)}</td>
                    <td>
                      <div style={{ fontSize: "0.8125rem", color: "#4b5563" }}>
                        {stream.products.length > 0 ? (
                          <span>📦 {stream.products.length}개 상품 연결</span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>연결 상품 없음</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                      {new Date(stream.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {stream.status !== "ended" ? (
                          <Link
                            href={`/admin/live/${stream.id}/control`}
                            className="admin-btn admin-btn-sm"
                            style={{
                              background: "linear-gradient(135deg, #db2777 0%, #9333ea 100%)",
                              color: "#fff",
                              border: "none",
                              fontWeight: 700,
                            }}
                          >
                            🕹️ 제어실
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/live/${stream.id}/control`}
                            className="admin-btn admin-btn-secondary admin-btn-sm"
                          >
                            ⚙️ 편집본 등록
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 방송 등록 모달 */}
      {showModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-container">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">＋ 라이브 방송 등록</h2>
              <button
                onClick={() => setShowModal(false)}
                className="admin-modal-close-btn"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="admin-field">
                  <label className="admin-label admin-label-required">방송 제목</label>
                  <input
                    className="admin-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="예) 여름 맞이 스킨케어 패키지 특별 세일!"
                  />
                </div>

                {/* 크루(호스트) 선택 드롭다운 */}
                <div className="admin-field">
                  <label className="admin-label">👤 담당 크루(호스트) 선택</label>
                  <select
                    className="admin-input"
                    value={selectedCrewId}
                    onChange={(e) => handleCrewSelect(e.target.value)}
                    style={{ cursor: "pointer" }}
                  >
                    <option value="">— 직접 입력 / IVS 자동 발급 —</option>
                    {allCrews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nickname}{c.ivs_playback_url ? " ✅ 채널 발급됨" : " ⚠️ 채널 없음"}
                      </option>
                    ))}
                  </select>
                  {selectedCrewId && (
                    <p style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "4px" }}>
                      ✅ 크루의 전용 채널이 자동으로 연결됩니다. 스트리머명과 스트리밍 주소가 자동 입력되었습니다.
                    </p>
                  )}
                </div>

                <div className="admin-field">
                  <label className="admin-label">방송 설명</label>
                  <textarea
                    className="admin-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="라이브 방송에 대한 간략한 홍보 멘트를 적어주세요."
                    rows={2}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="admin-field">
                    <label className="admin-label admin-label-required">스트리머명</label>
                    <input
                      className="admin-input"
                      value={streamerName}
                      onChange={(e) => setStreamerName(e.target.value)}
                      required
                      placeholder="크루 선택 시 자동 입력됩니다"
                      style={selectedCrewId ? { background: "#f0fdf4", color: "#15803d" } : undefined}
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label">커버 이미지 URL</label>
                    <input
                      className="admin-input"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label className="admin-label">📅 방송 예정 일시</label>
                  <input
                    className="admin-input"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    style={{ colorScheme: "light" }}
                  />
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "4px" }}>
                    설정 시 프론트 편성표 및 시청자 대기 화면에 카운트다운 타이머가 표시됩니다.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="admin-field">
                    <label className="admin-label">스트리밍 주소 (크루 선택 시 자동 입력)</label>
                    <input
                      className="admin-input"
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      placeholder="크루 선택 시 자동 입력 / 직접 입력도 가능"
                      style={selectedCrewId && streamUrl ? { background: "#f0fdf4", color: "#15803d" } : undefined}
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label">녹화본 다시보기 주소 (Vimeo/R2 등)</label>
                    <input
                      className="admin-input"
                      value={replayUrl}
                      onChange={(e) => setReplayUrl(e.target.value)}
                      placeholder="방송 종료 후 노출할 영상 URL"
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label className="admin-label">판매 연계 상품 선택 (중복 선택 가능)</label>
                  <div className="admin-product-checklist-box">
                    {allProducts.length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
                        등록된 상품이 없습니다. 상품 관리에서 먼저 등록해주세요.
                      </p>
                    ) : (
                      allProducts.map((p) => (
                        <label key={p.id} className="admin-checklist-item">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(p.id)}
                            onChange={() => handleProductToggle(p.id)}
                          />
                          <span style={{ fontSize: "0.875rem", marginLeft: "6px" }}>
                            {p.name}
                          </span>
                        </label>
                      ))
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
                  {submitting ? "등록 중..." : "방송 생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 스타일 */}
      <style jsx global>{`
        .admin-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .live-badge {
          background-color: #ffe4e6;
          color: #e11d48;
          animation: adminPulse 2s infinite ease-in-out;
        }
        .upcoming-badge {
          background-color: #fef3c7;
          color: #d97706;
        }
        .ended-badge {
          background-color: #f3f4f6;
          color: #4b5563;
        }
        
        .admin-product-checklist-box {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.75rem;
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: #f9fafb;
        }
        
        .admin-checklist-item {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
        
        .admin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          backdrop-filter: blur(4px);
        }
        
        .admin-modal-container {
          background: #fff;
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .admin-modal-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .admin-modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }
        
        .admin-modal-close-btn {
          border: none;
          background: none;
          font-size: 1.25rem;
          color: #9ca3af;
          cursor: pointer;
          transition: color 0.15s;
        }
        .admin-modal-close-btn:hover {
          color: #374151;
        }
        
        .admin-modal-container form {
          padding: 1.5rem;
        }
        
        .admin-modal-footer {
          margin-top: 1.5rem;
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        @keyframes adminPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}

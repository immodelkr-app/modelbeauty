"use client";

// ============================================================
// /admin/live/[id]/control — 라이브 방송 제어실 (Admin Only)
// ============================================================

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  images: { url: string }[];
  isActive: boolean;
}

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  streamerName: string;
  status: "upcoming" | "live" | "ended";
  coverImageUrl: string | null;
  streamUrl: string | null;
  replayUrl: string | null;
  ingestEndpoint: string | null;
  streamKey: string | null;
  activeProductId: string | null;
  viewerCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  scheduledAt: string | null;
  products: Product[];
}

interface ChatMessage {
  id: string;
  nickname: string;
  message: string;
  createdAt: string;
}

export default function AdminLiveControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: streamId } = use(params);
  const router = useRouter();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 제어 상태 폼
  const [replayUrl, setReplayUrl] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 5분 전 경고 배너 상태
  const [showAlertBanner, setShowAlertBanner] = useState(false);
  const [minsLeft, setMinsLeft] = useState<number | null>(null);

  // ── 데이터 로드 ──────────────────────────────────────────
  const fetchStreamData = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${streamId}`);
      const { data, success } = await res.json();
      if (success && data) {
        setStream(data);
        setReplayUrl(data.replayUrl ?? "");
      } else {
        alert("방송 정보를 불러오지 못했습니다.");
        router.push("/admin/live");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [streamId, router]);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${streamId}/chat`);
      const { data, success } = await res.json();
      if (success) {
        setChats(data ?? []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [streamId]);

  useEffect(() => {
    fetchStreamData();
    fetchChats();
  }, [fetchStreamData, fetchChats]);

  // ── 5분 전 커운트다운 타이머 및 웹 알림 유도 ─────────────────
  useEffect(() => {
    if (!stream?.scheduledAt || stream.status !== "upcoming") return;

    // 브라우저 알림 권한 요청
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let notificationSent = false;

    const interval = setInterval(() => {
      const now = Date.now();
      const scheduledTime = new Date(stream.scheduledAt!).getTime();
      const diffMs = scheduledTime - now;
      const diffMins = diffMs / 1000 / 60;

      // 방송이 시작되었거나 예정 시각이 지났으면 타이머 중지
      if (diffMins <= 0) {
        setShowAlertBanner(false);
        setMinsLeft(null);
        clearInterval(interval);
        return;
      }

      setMinsLeft(Math.floor(diffMins));

      if (diffMins <= 5) {
        setShowAlertBanner(true);

        // 브라우저 웹 푸시 알림 (한 번만 전송)
        if (!notificationSent && typeof Notification !== "undefined" && Notification.permission === "granted") {
          notificationSent = true;
          new Notification("방송 시작 5분 전! 프리즘 라이브 대기해 주세요", {
            body: `[${stream.title}] 지금 PRISM Live Studio 앱을 켜고 송출 URL과 키를 설정해 주세요.`,
            icon: "/favicon.ico",
            tag: `live-alert-${stream.id}`,
          });
          // 알림음 재생
          try {
            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.frequency.value = 880;
            oscillator.type = "sine";
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.8);
          } catch {/* AudioContext not available */}
        }
      } else {
        setShowAlertBanner(false);
      }
    }, 10000); // 10초마다 체크

    return () => clearInterval(interval);
  }, [stream?.scheduledAt, stream?.status, stream?.id, stream?.title]);

  // ── Supabase 실시간 구독 연동 ────────────────────────────
  useEffect(() => {
    if (!streamId) return;

    const supabase = createSupabaseBrowserClient();

    // 1. 실시간 채팅 구독
    const chatChannel = supabase
      .channel(`live-chats-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "model_beauty",
          table: "live_stream_chats",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload: any) => {
          const newChat: ChatMessage = {
            id: payload.new.id,
            nickname: payload.new.nickname,
            message: payload.new.message,
            createdAt: payload.new.created_at,
          };
          setChats((prev) => [...prev, newChat]);
        }
      )
      .subscribe();

    // 2. 실시간 방송 상태 업데이트 구독
    const streamChannel = supabase
      .channel(`live-stream-status-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "model_beauty",
          table: "live_streams",
          filter: `id=eq.${streamId}`,
        },
        (payload: any) => {
          setStream((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              status: payload.new.status,
              activeProductId: payload.new.active_product_id,
              viewerCount: payload.new.viewer_count,
              replayUrl: payload.new.replay_url,
              ingestEndpoint: payload.new.ingest_endpoint,
              streamKey: payload.new.stream_key,
              startedAt: payload.new.started_at,
              endedAt: payload.new.ended_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      chatChannel.unsubscribe();
      streamChannel.unsubscribe();
    };
  }, [streamId]);

  // ── 방송 상태 변경 제어 ──────────────────────────────────
  const handleStatusChange = async (newStatus: "live" | "ended") => {
    const confirmMsg =
      newStatus === "live"
        ? "방송을 시작하시겠습니까? 시청자들에게 온에어로 표시됩니다."
        : "방송을 종료하시겠습니까? 종료 시 전시 상품이 해제되며 다시 복구할 수 없습니다.";

    if (!confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/live/${streamId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          replayUrl: newStatus === "ended" ? replayUrl || null : undefined,
        }),
      });

      const { success, error } = await res.json();
      if (success) {
        await fetchStreamData();
      } else {
        alert(error ?? "상태 변경 실패");
      }
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 전시 상품 변경 제어 ──────────────────────────────────
  const handleFeaturedProductChange = async (productId: string | null) => {
    try {
      const res = await fetch(`/api/live/${streamId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeProductId: productId,
        }),
      });

      const { success, error } = await res.json();
      if (!success) {
        alert(error ?? "상품 전시 실패");
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    }
  };

  // ── 녹화본 URL 수동 등록/업데이트 ────────────────────────
  const handleSaveReplayUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/live/${streamId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replayUrl: replayUrl || null,
          status: stream?.status, // 현재 상태 유지
        }),
      });

      const { success, error } = await res.json();
      if (success) {
        alert("다시보기 영상 정보가 저장 및 연결되었습니다.");
        await fetchStreamData();
      } else {
        alert(error ?? "저장 실패");
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 어드민 실시간 답변 채팅 전송 ────────────────────────────
  const handleSendAdminChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminMessage.trim()) return;

    const chatContent = adminMessage.trim();
    setAdminMessage("");

    try {
      const res = await fetch(`/api/live/${streamId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatContent }),
      });
      const { success, error } = await res.json();
      if (!success) {
        alert(error ?? "채팅 전송에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("채팅 전송 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>;
  }

  if (!stream) return null;

  return (
    <>
      {/* 하엸 개시 5분 전 주의 배너 */}
      {showAlertBanner && stream.status === "upcoming" && (
        <div className="control-alert-banner">
          <span className="control-alert-icon">🚨</span>
          <div className="control-alert-text">
            <strong>방송 시작 {minsLeft}분 전입니다!</strong>
            {" "}지금 바로 <strong>PRISM Live Studio 앱</strong>을 켜고 아래의 스트림 URL과 키를 입력한 연결 후 송출 대기 화면으로 전환해 주세요.
          </div>
          <button onClick={() => setShowAlertBanner(false)} className="control-alert-close">✕</button>
        </div>
      )}

      <div className="admin-section-header">
        <div>
          <h1 className="admin-section-title">🎙️ 라이브 방송 제어실</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "4px" }}>
            {stream.title} ({stream.streamerName})
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => {
              const publicUrl = `${window.location.origin}/live/${streamId}`;
              navigator.clipboard.writeText(publicUrl);
              alert("시청자 방송 초대 링크가 클립보드에 복사되었습니다!\n" + publicUrl);
            }}
            className="admin-btn admin-btn-primary"
            style={{
              background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
              color: "#fff",
              border: "none",
              fontWeight: 700,
            }}
          >
            🔗 초대 링크 복사
          </button>
          <Link href="/admin/live" className="admin-btn admin-btn-secondary">
            ← 목록으로
          </Link>
        </div>
      </div>

      <div className="control-layout">
        {/* 왼쪽: 송출 및 영상 상태 제어 */}
        <div className="control-left">
          <div className="admin-card control-card">
            <h2 className="admin-card-title">📡 방송 송출 상태</h2>
            <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>
                현재 상태:
              </div>
              {stream.status === "live" && (
                <span className="live-pulse">🔴 실시간 송출 중</span>
              )}
              {stream.status === "upcoming" && (
                <span className="upcoming-badge-styled">⏳ 방송 대기 중</span>
              )}
              {stream.status === "ended" && (
                <span className="ended-badge-styled">🎬 방송 종료됨</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              {stream.status === "upcoming" && (
                <button
                  onClick={() => handleStatusChange("live")}
                  disabled={submitting}
                  className="admin-btn admin-btn-primary"
                  style={{
                    background: "#e11d48",
                    borderColor: "#e11d48",
                    padding: "1rem 2rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                >
                  🚀 방송 송출 시작
                </button>
              )}

              {stream.status === "live" && (
                <button
                  onClick={() => handleStatusChange("ended")}
                  disabled={submitting}
                  className="admin-btn"
                  style={{
                    background: "#374151",
                    color: "#fff",
                    border: "none",
                    padding: "1rem 2rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                >
                  ⏹️ 방송 송출 종료
                </button>
              )}
            </div>
          </div>

          {/* 송출 정보 카드 (AWS IVS 정보가 있을 때 노출) */}
          {stream.ingestEndpoint && stream.streamKey && (
            <div className="admin-card control-card" style={{ marginTop: "1.5rem" }}>
              <h2 className="admin-card-title">🔑 실시간 송출 설정 정보 (PRISM/OBS 입력용)</h2>
              <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
                스마트폰의 <strong>PRISM Live Studio</strong> 앱 또는 PC의 <strong>OBS Studio</strong> 설정에서 아래의 주소와 스트림 키를 각각 입력하신 후 송출을 시작해 주세요.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="admin-field">
                  <label className="admin-label" style={{ fontWeight: 700 }}>스트림 URL (RTMP 주소)</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className="admin-input"
                      readOnly
                      value={stream.ingestEndpoint}
                      style={{ background: "#f3f4f6", cursor: "text" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(stream.ingestEndpoint || "");
                        alert("스트림 URL이 클립보드에 복사되었습니다.");
                      }}
                      className="admin-btn admin-btn-secondary"
                      style={{ flexShrink: 0 }}
                    >
                      복사
                    </button>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "4px" }}>
                    ✅ <strong>프리즘 앱 바로 사용 가능:</strong> 위 주소를 그대로 복사하여 PRISM Live의 「서버 주소」에 붙여넣기 하세요. (<code>rtmp://</code> 형식으로 제공됩니다)
                  </p>
                </div>
                <div className="admin-field">
                  <label className="admin-label" style={{ fontWeight: 700 }}>스트림 키 (Stream Key)</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="password"
                      className="admin-input"
                      readOnly
                      value={stream.streamKey}
                      style={{ background: "#f3f4f6", cursor: "text" }}
                      id="stream-key-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("stream-key-input") as HTMLInputElement;
                        if (input) {
                          input.type = input.type === "password" ? "text" : "password";
                        }
                      }}
                      className="admin-btn admin-btn-secondary"
                      style={{ flexShrink: 0 }}
                    >
                      보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(stream.streamKey || "");
                        alert("스트림 키가 클립보드에 복사되었습니다.");
                      }}
                      className="admin-btn admin-btn-secondary"
                      style={{ flexShrink: 0 }}
                    >
                      복사
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 다시보기 주소 관리 카드 */}
          <div className="admin-card control-card" style={{ marginTop: "1.5rem" }}>
            <h2 className="admin-card-title">🎬 녹화본 다시보기 영상 연결</h2>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
              방송 종료 후 시청할 수 있는 다시보기 파일 URL(비메오, 유튜브, 스토리지 등)을 등록합니다.
              저장 시 연결 상품의 상세페이지에 다시보기 영상이 자동 게시됩니다.
            </p>
            <form onSubmit={handleSaveReplayUrl} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                className="admin-input"
                value={replayUrl}
                onChange={(e) => setReplayUrl(e.target.value)}
                placeholder="https://vimeo.com/..."
              />
              <button
                type="submit"
                disabled={submitting}
                className="admin-btn admin-btn-primary"
                style={{ alignSelf: "flex-end" }}
              >
                저장 및 자동 연결 적용
              </button>
            </form>
          </div>

          {/* PRISM Live 퀴 가이드 카드 */}
          <div className="admin-card control-card prism-guide-card" style={{ marginTop: "1.5rem" }}>
            <h2 className="admin-card-title">📱 PRISM Live 연동 5단계 퀴 가이드</h2>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
              방송 시작 <strong>5분 전</strong>에 아래 절차를 완료하고 송출 대기 상태를 유지하세요.
            </p>
            <ol className="prism-guide-steps">
              <li><span className="guide-step-num">1</span><span>스마트폰에서 <strong>PRISM Live Studio</strong> 앱을 실행합니다.</span></li>
              <li><span className="guide-step-num">2</span><span>오른쪽 위 ⚙️ 설정 → <strong>송출 설정</strong> → <strong>RTMP/Custom</strong> 선택</span></li>
              <li><span className="guide-step-num">3</span><span>위의 「스트림 URL」을 복사하여 「서버 주소」에 입력 (이미 <code>rtmp://</code> 형식으로 제공되므로 수정 불필요)</span></li>
              <li><span className="guide-step-num">4</span><span>위의 「스트림 키」를 복사하여 「스트림 키」에 입력</span></li>
              <li><span className="guide-step-num">5</span><span>「방송 시작」 터치 후 온에어 주화면을 확인, 위의 <strong>송출 시작</strong> 클릭</span></li>
            </ol>
          </div>
        </div>

        {/* 가운데: 소개 상품 실시간 변경 */}
        <div className="control-middle">
          <div className="admin-card control-card">
            <h2 className="admin-card-title">🛍️ 전시 및 소개 상품 스위칭</h2>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0.5rem 0 1rem" }}>
              선택한 상품이 시청자들 화면에 하단 배너 팝업으로 즉시 표시됩니다.
            </p>
            
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
              <button
                onClick={() => handleFeaturedProductChange(null)}
                disabled={!stream.activeProductId}
                className="admin-btn admin-btn-secondary admin-btn-sm"
              >
                ✕ 화면 노출 해제
              </button>
            </div>

            <div className="control-product-list">
              {stream.products.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
                  방송에 연결된 상품이 없습니다.
                </div>
              ) : (
                stream.products.map((p) => {
                  const isFeatured = stream.activeProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`control-product-card${isFeatured ? " featured" : ""}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          정가: {p.basePrice.toLocaleString()}원
                        </div>
                      </div>
                      <div>
                        {isFeatured ? (
                          <span className="live-badge-styled">🖥️ 노출 중</span>
                        ) : (
                          <button
                            onClick={() => handleFeaturedProductChange(p.id)}
                            disabled={stream.status !== "live"}
                            className="admin-btn admin-btn-primary admin-btn-sm"
                          >
                            화면 노출
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 채팅 및 시청자 모니터링 */}
        <div className="control-right-pane">
          <div className="admin-card control-card monitoring-chat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="admin-card-title">💬 실시간 채팅 모니터</h2>
              <span style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>
                시청자 수: {stream.viewerCount}명
              </span>
            </div>
            <div className="chat-logs-area">
              {chats.length === 0 ? (
                <p style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: "0.875rem" }}>
                  아직 채팅이 없습니다.
                </p>
              ) : (
                chats.map((c) => (
                  <div key={c.id} className="chat-log-item">
                    <span className={`chat-log-name${c.nickname === "모델뷰티" ? " admin-official" : ""}`}>
                      {c.nickname}:
                    </span>
                    <span className="chat-log-msg">{c.message}</span>
                  </div>
                ))
              )}
            </div>

            {/* 어드민 실시간 답변 전송 */}
            <form onSubmit={handleSendAdminChat} className="admin-chat-form">
              <input
                className="admin-chat-input"
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="모델뷰티 이름으로 답변 메시지 전송..."
              />
              <button type="submit" className="admin-chat-send-btn">
                전송
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 스타일 */}
      <style jsx>{`
        .control-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr;
          gap: 1.5rem;
          margin-top: 1rem;
          align-items: start;
        }
        
        .control-card {
          padding: 1.5rem;
          min-height: 250px;
        }

        .live-pulse {
          color: #e11d48;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .live-pulse::before {
          content: "";
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #e11d48;
          animation: adminPulse 1.5s infinite ease-in-out;
        }

        .upcoming-badge-styled {
          background-color: #fef3c7;
          color: #d97706;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .ended-badge-styled {
          background-color: #f3f4f6;
          color: #4b5563;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .control-product-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .control-product-card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f9fafb;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .control-product-card.featured {
          border-color: #db2777;
          background: #fdf2f8;
        }

        .live-badge-styled {
          background-color: #db2777;
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
        }

        .monitoring-chat-card {
          display: flex;
          flex-direction: column;
          height: 480px;
        }

        .chat-logs-area {
          flex: 1;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
          padding: 0.75rem;
          overflow-y: auto;
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .chat-log-item {
          font-size: 0.8125rem;
          line-height: 1.4;
          word-break: break-all;
        }

        .chat-log-name {
          font-weight: 700;
          color: #4b5563;
          margin-right: 6px;
        }

        .chat-log-msg {
          color: #1f2937;
        }

        .chat-log-name.admin-official {
          color: #db2777;
          background: #fdf2f8;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 800;
          border: 1px solid #fbcfe8;
        }

        .admin-chat-form {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .admin-chat-input {
          flex: 1;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          background: #fff;
          color: #171717;
        }
        .admin-chat-input:focus {
          outline: none;
          border-color: #db2777;
        }

        .admin-chat-send-btn {
          background: #db2777;
          border: none;
          color: #fff;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .admin-chat-send-btn:hover {
          background: #be185d;
        }

        @keyframes adminPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.4; }
        }

        /* 5분 전 경고 배너 */
        .control-alert-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: #fff;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          margin-bottom: 1.25rem;
          animation: alertPulse 2s infinite ease-in-out;
          box-shadow: 0 4px 20px rgba(220,38,38,0.35);
        }
        .control-alert-icon {
          font-size: 1.75rem;
          flex-shrink: 0;
        }
        .control-alert-text {
          flex: 1;
          font-size: 0.9375rem;
          line-height: 1.5;
        }
        .control-alert-close {
          background: rgba(255,255,255,0.2);
          border: none;
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .control-alert-close:hover {
          background: rgba(255,255,255,0.35);
        }
        @keyframes alertPulse {
          0%, 100% { opacity: 1; box-shadow: 0 4px 20px rgba(220,38,38,0.35); }
          50% { opacity: 0.88; box-shadow: 0 4px 30px rgba(220,38,38,0.55); }
        }

        /* PRISM 퀴 가이드 커드 */
        .prism-guide-card {
          background: linear-gradient(135deg, #f8f0ff 0%, #fdf4ff 100%);
          border: 1.5px solid #e9d5ff;
        }
        .prism-guide-steps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }
        .prism-guide-steps li {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.8125rem;
          color: #374151;
          line-height: 1.5;
        }
        .guide-step-num {
          background: #7c3aed;
          color: #fff;
          font-size: 0.6875rem;
          font-weight: 700;
          min-width: 20px;
          height: 20px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        @media (max-width: 1024px) {
          .control-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

"use client";

// ============================================================
// LiveRoomClient — 실시간 라이브 스트리밍 룸 (Client Component)
// ============================================================

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";

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

interface LiveRoomClientProps {
  initialStream: LiveStream;
  initialChats: ChatMessage[];
}

// 뷰티 컨셉의 무료 고화질 루핑 비디오 예시
const MOCK_BEAUTY_VIDEO_URL =
  "https://assets.mixkit.co/videos/preview/mixkit-beautiful-woman-applying-makeup-44445-large.mp4";

export default function LiveRoomClient({ initialStream, initialChats }: LiveRoomClientProps) {
  const [stream, setStream] = useState<LiveStream>(initialStream);
  const [chats, setChats] = useState<ChatMessage[]>(initialChats);
  const [message, setMessage] = useState("");
  const { isLoggedIn, masterUser } = useAuthStore();
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // 음소거 관련 상태 (브라우저 자동재생 음소거 정책 우회용)
  const [isMuted, setIsMuted] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartsContainerRef = useRef<HTMLDivElement>(null);

  // ── 대기 화면 카운트다운 타이머 ────────────────────────────────
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number; secs: number } | null>(null);

  useEffect(() => {
    if (stream.status !== "upcoming" || !stream.scheduledAt) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const diff = new Date(stream.scheduledAt!).getTime() - Date.now();
      if (diff <= 0) { setCountdown(null); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown({ days, hours, mins, secs });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [stream.status, stream.scheduledAt]);

  // ── 진행 중인 전시 상품 찾기 ──────────────────────────────
  useEffect(() => {
    if (stream.activeProductId) {
      const prod = stream.products.find((p) => p.id === stream.activeProductId);
      setActiveProduct(prod || null);
    } else {
      setActiveProduct(null);
    }
  }, [stream.activeProductId, stream.products]);

  // ── Supabase 실시간 연동 ────────────────────────────────
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // 1. 실시간 채팅 수신 리스너
    const chatChannel = supabase
      .channel(`live-chats-room-${stream.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "model_beauty",
          table: "live_stream_chats",
          filter: `stream_id=eq.${stream.id}`,
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

    // 2. 실시간 방송 상태 및 activeProductId 감지 리스너
    const streamChannel = supabase
      .channel(`live-stream-room-${stream.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "model_beauty",
          table: "live_streams",
          filter: `id=eq.${stream.id}`,
        },
        (payload: any) => {
          setStream((prev) => ({
            ...prev,
            status: payload.new.status,
            activeProductId: payload.new.active_product_id,
            viewerCount: payload.new.viewer_count,
            replayUrl: payload.new.replay_url,
            startedAt: payload.new.started_at,
            endedAt: payload.new.ended_at,
          }));
        }
      )
      .subscribe();

    return () => {
      chatChannel.unsubscribe();
      streamChannel.unsubscribe();
    };
  }, [stream.id]);

  // 채팅 스크롤 제어
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  // ── 채팅 메시지 전송 ──────────────────────────────────────
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isLoggedIn) return;

    const chatContent = message;
    setMessage(""); // 즉시 인풋 비우기

    try {
      const res = await fetch(`/api/live/${stream.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatContent }),
      });

      const { success, error } = await res.json();
      if (!success) {
        console.error("Failed to persist chat:", error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── 하트 인터랙션 (Popping Hearts) ─────────────────────────
  const handleLike = () => {
    if (!heartsContainerRef.current) return;

    const heart = document.createElement("div");
    heart.className = "popping-heart";
    heart.innerHTML = "❤️";
    
    // 무작위 위치 및 크기 설정
    const randomLeft = Math.random() * 60 + 20; // 20% ~ 80%
    const randomSize = Math.random() * 1.5 + 1; // 1rem ~ 2.5rem
    const randomRotate = Math.random() * 40 - 20; // -20deg ~ 20deg

    heart.style.left = `${randomLeft}%`;
    heart.style.fontSize = `${randomSize}rem`;
    heart.style.transform = `rotate(${randomRotate}deg)`;

    heartsContainerRef.current.appendChild(heart);

    // 애니메이션이 끝나면 요소 제거
    setTimeout(() => {
      heart.remove();
    }, 2000);
  };

  // 비디오 소스 결정
  const videoUrl =
    stream.status === "live"
      ? stream.streamUrl || MOCK_BEAUTY_VIDEO_URL
      : stream.replayUrl || MOCK_BEAUTY_VIDEO_URL;

  // upcoming 상태라면 대기 화면을 노출해줌
  if (stream.status === "upcoming") {
    return (
      <div className="liveroom-root">
        <div className="upcoming-waiting-room">
          <div className="waiting-glow-bg" />
          <div className="waiting-card">
            <div className="waiting-badge">COMING SOON</div>
            <h2 className="waiting-host">{stream.streamerName}의 라이브 쇼핑</h2>
            <h1 className="waiting-title">{stream.title}</h1>
            {stream.description && <p className="waiting-desc">{stream.description}</p>}

            {countdown ? (
              <div className="countdown-wrapper">
                <p className="countdown-label">방송 시작까지</p>
                <div className="countdown-tiles">
                  {countdown.days > 0 && (
                    <div className="countdown-tile">
                      <span className="countdown-num">{String(countdown.days).padStart(2,"0")}</span>
                      <span className="countdown-unit">일</span>
                    </div>
                  )}
                  <div className="countdown-tile">
                    <span className="countdown-num">{String(countdown.hours).padStart(2,"0")}</span>
                    <span className="countdown-unit">시간</span>
                  </div>
                  <div className="countdown-sep">:</div>
                  <div className="countdown-tile">
                    <span className="countdown-num">{String(countdown.mins).padStart(2,"0")}</span>
                    <span className="countdown-unit">분</span>
                  </div>
                  <div className="countdown-sep">:</div>
                  <div className="countdown-tile">
                    <span className="countdown-num">{String(countdown.secs).padStart(2,"0")}</span>
                    <span className="countdown-unit">초</span>
                  </div>
                </div>
              </div>
            ) : stream.scheduledAt ? (
              <p className="waiting-time-info">
                {new Date(stream.scheduledAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 예정
              </p>
            ) : (
              <p className="waiting-time-info">일정 미정 — 먹 눈요를 보내주세요!</p>
            )}

            {stream.products.length > 0 && (
              <div className="waiting-products">
                <p className="waiting-products-label">게시예정 특가 상품</p>
                <div className="waiting-product-list">
                  {stream.products.slice(0, 3).map((p) => (
                    <div key={p.id} className="waiting-prod-pill">
                      <span>{p.name}</span>
                      {p.salePrice && (
                        <span className="waiting-prod-price">{p.salePrice.toLocaleString()}원</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          .upcoming-waiting-room {
            min-height: 100vh;
            background: linear-gradient(145deg, #0f0524 0%, #1e0a3c 40%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            padding: 2rem;
          }
          .waiting-glow-bg {
            position: absolute;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(219,39,119,0.18) 0%, transparent 70%);
            top: 50%;
            left: 50%;
            transform: translate(-50%,-50%);
            pointer-events: none;
          }
          .waiting-card {
            position: relative;
            z-index: 1;
            max-width: 560px;
            width: 100%;
            text-align: center;
            padding: 3rem 2.5rem;
            border-radius: 24px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(16px);
            box-shadow: 0 25px 60px rgba(0,0,0,0.4);
          }
          .waiting-badge {
            display: inline-block;
            background: linear-gradient(135deg, #db2777 0%, #7c3aed 100%);
            color: #fff;
            font-size: 0.6875rem;
            font-weight: 900;
            letter-spacing: 0.15em;
            padding: 5px 16px;
            border-radius: 9999px;
            margin-bottom: 1.25rem;
          }
          .waiting-host {
            font-size: 0.875rem;
            color: rgba(255,255,255,0.5);
            font-weight: 500;
            margin-bottom: 0.5rem;
          }
          .waiting-title {
            font-size: 1.625rem;
            font-weight: 900;
            color: #fff;
            line-height: 1.3;
            margin-bottom: 0.75rem;
          }
          .waiting-desc {
            font-size: 0.9rem;
            color: rgba(255,255,255,0.55);
            margin-bottom: 1.5rem;
          }
          .countdown-wrapper {
            margin: 1.75rem 0;
          }
          .countdown-label {
            font-size: 0.75rem;
            color: rgba(255,255,255,0.4);
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
          }
          .countdown-tiles {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          }
          .countdown-tile {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 12px;
            padding: 0.75rem 1rem;
            min-width: 64px;
          }
          .countdown-num {
            font-size: 2rem;
            font-weight: 900;
            color: #fff;
            line-height: 1;
            font-variant-numeric: tabular-nums;
          }
          .countdown-unit {
            font-size: 0.6875rem;
            color: rgba(255,255,255,0.4);
            margin-top: 4px;
          }
          .countdown-sep {
            font-size: 1.75rem;
            font-weight: 900;
            color: rgba(255,255,255,0.3);
            margin-bottom: 16px;
          }
          .waiting-time-info {
            font-size: 0.9375rem;
            color: rgba(255,255,255,0.55);
            margin: 1.5rem 0;
          }
          .waiting-products {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid rgba(255,255,255,0.08);
          }
          .waiting-products-label {
            font-size: 0.75rem;
            color: rgba(255,255,255,0.4);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
          }
          .waiting-product-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: center;
          }
          .waiting-prod-pill {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(219,39,119,0.15);
            border: 1px solid rgba(219,39,119,0.3);
            border-radius: 9999px;
            padding: 6px 14px;
            font-size: 0.8125rem;
            color: #fbcfe8;
            font-weight: 600;
          }
          .waiting-prod-price {
            color: #f9a8d4;
            font-weight: 800;
          }
        `}</style>
      </div>
    );
  }

  const embed = getEmbedUrl(videoUrl || "");

  return (
    <div className="liveroom-root">
      <div className="liveroom-container">
        
        {/* 왼쪽: 비디오 스트리밍 영역 */}
        <div className="liveroom-video-pane">
          <div className="video-player-wrapper">
             {embed.type !== "direct" ? (
              <iframe
                src={embed.url}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="live-video-element"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : (
              <video
                src={videoUrl}
                autoPlay
                muted={isMuted}
                loop
                playsInline
                controls
                className="live-video-element"
              />
            )}

            {/* 음소거 해제 플로팅 버튼 */}
            {isMuted && embed.type === "direct" && (
              <button
                onClick={() => setIsMuted(false)}
                className="unmute-overlay-btn"
                title="소리 켜기"
              >
                <span className="unmute-icon">🔇</span>
                <span className="unmute-text">화면을 클릭하여 소리 켜기</span>
              </button>
            )}

            {/* 비디오 위의 메타 오버레이 */}
            <div className="video-overlay-top">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {stream.status === "live" ? (
                  <span className="overlay-badge live-badge">LIVE</span>
                ) : (
                  <span className="overlay-badge replay-badge">다시보기</span>
                )}
                <span className="overlay-viewers">👤 {stream.viewerCount.toLocaleString()}명</span>
              </div>
              <h2 className="overlay-stream-title">{stream.title}</h2>
            </div>

            {/* 하트 파티클 컨테이너 */}
            <div ref={heartsContainerRef} className="hearts-container" />

            {/* 실시간 전시 상품 오버레이 팝업 */}
            {activeProduct && (
              <div className="floating-live-product-wrap">
                <div className="featured-product-overlay-card">
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <div className="overlay-prod-image">
                      {pimg(activeProduct) ? (
                        <Image
                          src={pimg(activeProduct)!}
                          alt={activeProduct.name}
                          fill
                          sizes="60px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        "💄"
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="overlay-prod-label">방송에서 소개 중인 제품</div>
                      <div className="overlay-prod-name">{activeProduct.name}</div>
                      <div className="overlay-prod-price">
                        {activeProduct.salePrice ? (
                          <>
                            <span className="sale-p">
                              {activeProduct.salePrice.toLocaleString()}원
                            </span>
                            <span className="base-p">
                              {activeProduct.basePrice.toLocaleString()}원
                            </span>
                          </>
                        ) : (
                          <span>{activeProduct.basePrice.toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`/products/${activeProduct.slug}?stream_id=${stream.id}`, "_blank")}
                    className="overlay-buy-btn"
                  >
                    구매하기
                  </button>
                </div>
              </div>
            )}

            {/* 플로팅 좋아요 버튼 */}
            <button onClick={handleLike} className="floating-like-btn" aria-label="좋아요">
              💖
            </button>
          </div>

          {/* 스트리밍 정보 하단 */}
          <div className="stream-detail-info">
            <div className="stream-streamer-avatar">👩‍💼</div>
            <div style={{ flex: 1 }}>
              <div className="streamer-name">{stream.streamerName}</div>
              <p className="stream-description">{stream.description || "모델뷰티 라이브 쇼핑에 오신 것을 환영합니다!"}</p>
            </div>
          </div>
        </div>

        {/* 오른쪽: 채팅 패널 */}
        <div className="liveroom-chat-pane">
          <div className="chat-header">
            <h3>실시간 채팅</h3>
          </div>

          <div className="chat-messages-box">
            {chats.map((c) => (
              <div key={c.id} className="chat-msg-line">
                <span className={`chat-user-nick${c.nickname === "모델뷰티" ? " admin-official" : ""}`}>
                  {c.nickname === "모델뷰티" ? "📢 모델뷰티" : c.nickname}
                </span>
                <span className={`chat-user-text${c.nickname === "모델뷰티" ? " admin-official" : ""}`}>
                  {c.message}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-bar">
            {isLoggedIn ? (
              <form onSubmit={handleSendChat} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="chat-text-input"
                  placeholder="메시지를 입력하세요..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={100}
                />
                <button type="submit" className="chat-send-btn">
                  전송
                </button>
              </form>
            ) : (
              <div className="chat-login-hint">
                <Link href={`/login?redirect=/live/${stream.id}`} style={{ color: "var(--mb-pink-500)", fontWeight: 700, textDecoration: "underline" }}>
                  로그인
                </Link>
                후 채팅에 참여하실 수 있습니다.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 스타일 */}
      <style jsx global>{`
        .liveroom-root {
          min-height: 100vh;
          background: #0f172a; /* 시청룸 전용 럭셔리 다크 배경 */
          color: #f8fafc;
          padding: 2rem 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .liveroom-container {
          width: 100%;
          max-width: 1200px;
          height: 640px;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          display: flex;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .liveroom-video-pane {
          flex: 2.2;
          display: flex;
          flex-direction: column;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          background: #020617;
        }

        .video-player-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          overflow: hidden;
        }

        .live-video-element {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .video-overlay-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 1.5rem;
          background: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%);
          pointer-events: none;
        }

        .overlay-badge {
          font-size: 0.6875rem;
          font-weight: 800;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          color: #fff;
        }
        .overlay-badge.live-badge {
          background: #e11d48;
          animation: overlayPulse 2s infinite ease-in-out;
        }
        .overlay-badge.replay-badge {
          background: #3b82f6;
        }

        .overlay-viewers {
          font-size: 0.75rem;
          background: rgba(0,0,0,0.5);
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
        }

        .overlay-stream-title {
          font-size: 1.125rem;
          font-weight: 700;
          margin-top: 0.5rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .floating-live-product-wrap {
          position: absolute;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 10;
          animation: cardFloat 4s ease-in-out infinite;
        }

        .featured-product-overlay-card {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1rem;
          width: 320px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideUpIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }

        .overlay-prod-image {
          width: 50px;
          height: 50px;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
          background: #1e293b;
        }

        .overlay-prod-label {
          font-size: 0.625rem;
          color: var(--mb-pink-400);
          font-weight: 700;
          text-transform: uppercase;
        }

        .overlay-prod-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 170px;
        }

        .overlay-prod-price {
          font-size: 0.75rem;
          margin-top: 2px;
        }
        .overlay-prod-price .sale-p {
          color: #f472b6;
          font-weight: 800;
        }
        .overlay-prod-price .base-p {
          color: #94a3b8;
          text-decoration: line-through;
          margin-left: 4px;
        }

        .overlay-buy-btn {
          background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
          color: #fff;
          border: none;
          padding: 0.5rem 0.875rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .overlay-buy-btn:hover {
          transform: scale(1.05);
        }

        .floating-like-btn {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(236, 72, 153, 0.2);
          border: 1px solid rgba(236, 72, 153, 0.4);
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(4px);
          transition: transform 0.1s;
          z-index: 10;
        }
        .floating-like-btn:active {
          transform: scale(0.9);
        }

        /* 하트 파티클 */
        .hearts-container {
          position: absolute;
          bottom: 1.5rem;
          right: 1.5rem;
          width: 60px;
          height: 300px;
          pointer-events: none;
          overflow: hidden;
          z-index: 9;
        }

        .popping-heart {
          position: absolute;
          bottom: 0;
          animation: heartFloatUp 2s ease-out forwards;
          opacity: 0;
        }

        .stream-detail-info {
          padding: 1.25rem 1.5rem;
          background: #0f172a;
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .stream-streamer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #334155;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .streamer-name {
          font-weight: 700;
          color: #f1f5f9;
        }

        .stream-description {
          font-size: 0.8125rem;
          color: #94a3b8;
          margin-top: 2px;
        }

        /* 오른쪽: 채팅 패널 */
        .liveroom-chat-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(15, 23, 42, 0.6);
        }

        .chat-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .chat-header h3 {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #e2e8f0;
        }

        .chat-messages-box {
          flex: 1;
          padding: 1rem 1.5rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .chat-msg-line {
          font-size: 0.8125rem;
          line-height: 1.5;
          word-break: break-all;
        }

         .chat-user-nick {
          font-weight: 700;
          color: #cbd5e1;
          margin-right: 6px;
          background: rgba(255,255,255,0.05);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .chat-user-nick.admin-official {
          color: #ec4899 !important; /* var(--mb-pink-500) */
          background: rgba(236, 72, 153, 0.15) !important;
          border: 1px solid rgba(236, 72, 153, 0.3);
          font-weight: 900;
        }

        .chat-user-text {
          color: #f1f5f9;
        }
        .chat-user-text.admin-official {
          color: #fbcfe8 !important; /* var(--mb-pink-100) / pink-200 */
          font-weight: 700;
        }

        .chat-input-bar {
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(15, 23, 42, 0.8);
        }

        .chat-text-input {
          flex: 1;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          color: #fff;
          font-size: 0.8125rem;
        }
        .chat-text-input:focus {
          outline: none;
          border-color: var(--mb-pink-500);
        }

        .chat-send-btn {
          background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
          border: none;
          color: #fff;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
        }

        .chat-login-hint {
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
          padding: 0.25rem 0;
        }

        @keyframes heartFloatUp {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-260px) scale(1.2);
            opacity: 0;
          }
        }

        @keyframes overlayPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes slideUpIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes cardFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }

        @media (max-width: 768px) {
          .liveroom-container {
            flex-direction: column;
            height: auto;
          }
          .liveroom-video-pane {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .chat-messages-box {
            height: 250px;
          }
          .floating-live-product-wrap {
            width: calc(100% - 3rem);
            left: 1.5rem;
            bottom: 1.5rem;
          }
          .featured-product-overlay-card {
            width: 100%;
          }
        }

        /* 음소거 해제 오버레이 버튼 */
        .unmute-overlay-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 23, 42, 0.85);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          padding: 0.875rem 1.5rem;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          gap: 0.625rem;
          cursor: pointer;
          z-index: 10;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          transition: background 0.2s, transform 0.2s;
          animation: pulseUnmute 2s infinite ease-in-out;
        }
        .unmute-overlay-btn:hover {
          background: rgba(15, 23, 42, 0.95);
          transform: translate(-50%, -50%) scale(1.05);
        }
        .unmute-icon {
          font-size: 1.25rem;
        }
        .unmute-text {
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        @keyframes pulseUnmute {
          0%, 100% {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          50% {
            box-shadow: 0 10px 35px rgba(219, 39, 119, 0.4);
            border-color: rgba(219, 39, 119, 0.6);
          }
        }
      `}</style>
    </div>
  );
}

// 헬퍼: 첫 번째 이미지 URL 반환
function pimg(prod: Product) {
  const imgs = prod.images ?? [];
  return imgs[0]?.url ?? null;
}

function getEmbedUrl(url: string): { type: "youtube" | "vimeo" | "direct"; url: string } {
  if (!url) return { type: "direct", url: "" };

  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: "youtube", url: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: "vimeo", url: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  return { type: "direct", url };
}

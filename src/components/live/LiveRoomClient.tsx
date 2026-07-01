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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartsContainerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="liveroom-root">
      <div className="liveroom-container">
        
        {/* 왼쪽: 비디오 스트리밍 영역 */}
        <div className="liveroom-video-pane">
          <div className="video-player-wrapper">
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="live-video-element"
            />

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
                  onClick={() => window.open(`/products/${activeProduct.slug}`, "_blank")}
                  className="overlay-buy-btn"
                >
                  구매하기
                </button>
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
                <span className="chat-user-nick">{c.nickname}</span>
                <span className="chat-user-text">{c.message}</span>
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

        .featured-product-overlay-card {
          position: absolute;
          bottom: 1.5rem;
          left: 1.5rem;
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
          z-index: 10;
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

        .chat-user-text {
          color: #f1f5f9;
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
          .featured-product-overlay-card {
            width: calc(100% - 3rem);
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

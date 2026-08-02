"use client";

// ============================================================
// LiveRoomClient — 실시간 라이브 스트리밍 룸 (Client Component)
// ============================================================

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/auth.store";

interface Product {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  images: { url: string }[];
  isActive: boolean;
  description?: string | null;
  stockQuantity?: number;
  soldCount?: number;
  isLiveDeal?: boolean;
  dealEndsAt?: string | null;
}

const LOW_STOCK_THRESHOLD = 10;

interface CartToast {
  id: string;
  nickname: string;
  productName: string;
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
  pinnedMessage?: string | null;
  viewerCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  scheduledAt: string | null;
  products: Product[];
  isSubscribed?: boolean;
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

  // ── 슬라이드업 상품 패널 상태 ────────────────────────────────
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [panelProduct, setPanelProduct] = useState<Product | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // ── 장바구니 담기 토스트 상태 ─────────────────────────────────
  const [cartToasts, setCartToasts] = useState<CartToast[]>([]);

  // ── 전체 상품 목록 바텀시트 ────────────────────────────────────
  const [showProductList, setShowProductList] = useState(false);

  // ── 방송 시작 알림 구독 ─────────────────────────────────────
  const [subscribed, setSubscribed] = useState(!!initialStream.isSubscribed);
  const [subscribing, setSubscribing] = useState(false);
  const prevStatusRef = useRef(initialStream.status);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const heartsContainerRef = useRef<HTMLDivElement>(null);
  const chatPaneRef = useRef<HTMLDivElement>(null);

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

  // ── 폴링 방식 실시간 연동 (Supabase Realtime이 커스텀 스키마 미지원으로 폴링으로 대체) ──
  // 어드민 제어실(/admin/live/[id]/control)과 동일한 방식: 채팅 5초, 방송 상태 10초 주기 폴링
  useEffect(() => {
    if (!stream.id) return;

    // 채팅 폴링: 5초마다 최신 메시지 목록으로 갱신
    const chatTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${stream.id}/chat`);
        const { data, success } = await res.json();
        if (success && data) {
          setChats(data);
        }
      } catch (e) {
        console.error("[ChatPoll]", e);
      }
    }, 5000);

    // 방송 상태 + 시청자 수 + 전시상품 폴링: 10초마다 갱신
    const streamTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/${stream.id}`);
        const { data, success } = await res.json();
        if (success && data) {
          // 대기 → 방송 시작 전환 감지: 알림 신청자에게 브라우저 알림 발송
          if (prevStatusRef.current === "upcoming" && data.status === "live" && subscribed) {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification(`${data.streamerName}님의 라이브가 시작됐어요!`, {
                body: data.title,
                icon: "/favicon.ico",
                tag: `live-start-${data.id}`,
              });
            }
          }
          prevStatusRef.current = data.status;

          setStream((prev) => ({
            ...prev,
            status: data.status,
            activeProductId: data.activeProductId,
            pinnedMessage: data.pinnedMessage,
            viewerCount: data.viewerCount,
            replayUrl: data.replayUrl,
            startedAt: data.startedAt,
            endedAt: data.endedAt,
            products: data.products ?? prev.products,
          }));
        }
      } catch (e) {
        console.error("[StreamPoll]", e);
      }
    }, 10000);

    return () => {
      clearInterval(chatTimer);
      clearInterval(streamTimer);
    };
  }, [stream.id]);

  // ── 시청자 수 집계 (방송 입장/이탈 시 viewer_count 증감) ──────
  useEffect(() => {
    if (stream.status !== "live") return;

    fetch(`/api/live/${stream.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    }).catch(() => {});

    const leave = () => {
      navigator.sendBeacon(
        `/api/live/${stream.id}/view`,
        new Blob([JSON.stringify({ action: "leave" })], { type: "application/json" })
      );
    };

    window.addEventListener("pagehide", leave);
    return () => {
      leave();
      window.removeEventListener("pagehide", leave);
    };
  }, [stream.id, stream.status]);

  // 채팅 스크롤 제어
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  // ── 모바일 키보드 대응 (visualViewport) ────────────────────────
  // 키보드가 올라올 때 채팅 입력란이 가려지지 않도록 뷰포트 높이를 동적으로 조절
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      if (chatPaneRef.current) {
        // 키보드가 올라오면 남은 뷰포트 높이를 채팅 패널에 반영
        const availableHeight = vv.height;
        chatPaneRef.current.style.height = `${availableHeight}px`;
        // 최신 채팅 메시지로 스크롤
        chatEndRef.current?.scrollIntoView({ behavior: "instant" });
      }
    };

    const handleScroll = () => {
      if (chatPaneRef.current) {
        chatPaneRef.current.style.top = `${vv.offsetTop}px`;
      }
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleScroll);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleScroll);
    };
  }, []);

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

  // ── 슬라이드업 패널 열기 ────────────────────────────────────
  const handleOpenPanel = async (product: Product) => {
    setShowProductPanel(true);
    setPanelLoading(true);
    setPanelProduct(product);
    // 상품 상세 설명 추가 로드
    try {
      const res = await fetch(`/api/products/${product.slug}`);
      const { data, success } = await res.json();
      if (success && data) {
        setPanelProduct((prev) => prev ? { ...prev, description: data.description } : prev);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPanelLoading(false);
    }
  };

  const handleClosePanel = () => {
    setShowProductPanel(false);
    setPanelProduct(null);
  };

  // ── 장바구니 담기 처리 ────────────────────────────────────────
  const handleAddToCart = async () => {
    if (!panelProduct) return;
    if (!isLoggedIn) return; // 비로그인은 JSX에서 처리

    setAddingToCart(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: panelProduct.id, quantity: 1 }),
      });
      const result = await res.json();
      if (result.success) {
        // 라이브 방송 유입 구매 귀속 추적 (정산/매출 분석용)
        sessionStorage.setItem("last_live_stream_id", stream.id);
        // 토스트 추가
        const toastId = `${Date.now()}-${Math.random()}`;
        const nickname = masterUser?.name || "고객";
        const newToast: CartToast = {
          id: toastId,
          nickname,
          productName: panelProduct.name,
        };
        setCartToasts((prev) => [...prev, newToast]);
        // 3초 후 자동 제거
        setTimeout(() => {
          setCartToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, 3500);
        handleClosePanel();
      } else {
        alert(result.error ?? "장바구니 담기에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setAddingToCart(false);
    }
  };

  // ── 방송 시작 알림 구독 토글 ────────────────────────────────
  const handleToggleSubscribe = async () => {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/live/${stream.id}`;
      return;
    }
    if (subscribing) return;

    setSubscribing(true);
    try {
      if (subscribed) {
        const res = await fetch(`/api/live/${stream.id}/subscribe`, { method: "DELETE" });
        const { success } = await res.json();
        if (success) setSubscribed(false);
      } else {
        // 브라우저 알림 권한 요청 (탭이 열려있는 동안 방송 시작 시 알림 표시)
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          await Notification.requestPermission();
        }
        const res = await fetch(`/api/live/${stream.id}/subscribe`, { method: "POST" });
        const { success } = await res.json();
        if (success) setSubscribed(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribing(false);
    }
  };

  // ── 하트 인터랙션 (Popping Hearts) ─────────────────────────
  const handleLike = () => {
    if (!heartsContainerRef.current) return;

    const heart = document.createElement("div");
    heart.className = "popping-heart";
    heart.innerHTML = "❤️";
    
    // 무작위 위치 및 크기 설정
    const randomLeft = Math.random() * 50 + 25; // 25% ~ 75% (짤림 방지 중앙 분산)
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

            <button
              onClick={handleToggleSubscribe}
              disabled={subscribing}
              className={`waiting-notify-btn${subscribed ? " subscribed" : ""}`}
            >
              {subscribed ? "🔔 알림 신청 완료" : "🔕 방송 시작 알림 신청"}
            </button>

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
          .waiting-notify-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.18);
            color: #fff;
            font-size: 0.875rem;
            font-weight: 700;
            padding: 0.75rem 1.5rem;
            border-radius: 9999px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
            margin-top: 0.5rem;
          }
          .waiting-notify-btn:hover {
            background: rgba(255,255,255,0.14);
          }
          .waiting-notify-btn.subscribed {
            background: linear-gradient(135deg, #db2777 0%, #7c3aed 100%);
            border-color: transparent;
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {stream.status === "live" ? (
                    <span className="overlay-badge live-badge">LIVE</span>
                  ) : (
                    <span className="overlay-badge replay-badge">다시보기</span>
                  )}
                  <span className="overlay-viewers">👤 {stream.viewerCount.toLocaleString()}명</span>
                </div>
                {stream.products.length > 0 && (
                  <button
                    onClick={() => setShowProductList(true)}
                    className="overlay-product-list-btn"
                    style={{ pointerEvents: "auto" }}
                  >
                    🛍️ 상품 {stream.products.length}
                  </button>
                )}
              </div>
              <h2 className="overlay-stream-title">{stream.title}</h2>
            </div>

            {/* 하트 파티클 컨테이너 */}
            <div ref={heartsContainerRef} className="hearts-container" />

            {/* 실시간 전시 상품 오버레이 팝업 */}
            {activeProduct && (
              <div className="floating-live-product-wrap">
                <div className="featured-product-overlay-card">
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flex: 1, minWidth: 0 }}>
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
                      {(isActiveLiveDeal(activeProduct) || isSoldOut(activeProduct) || isLowStock(activeProduct) || (activeProduct.soldCount ?? 0) > 0) && (
                        <div className="overlay-prod-badges">
                          {isActiveLiveDeal(activeProduct) && (
                            <span className="live-urgency-badge deal">
                              ⚡ 라이브특가{activeProduct.dealEndsAt ? ` · ${formatDealCountdown(activeProduct.dealEndsAt)}` : ""}
                            </span>
                          )}
                          {isSoldOut(activeProduct) ? (
                            <span className="live-urgency-badge soldout">품절</span>
                          ) : isLowStock(activeProduct) ? (
                            <span className="live-urgency-badge lowstock">🔥 품절임박 {activeProduct.stockQuantity}개</span>
                          ) : null}
                          {(activeProduct.soldCount ?? 0) > 0 && (
                            <span className="live-urgency-badge sold">🛒 실시간 {activeProduct.soldCount}개 판매</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenPanel(activeProduct)}
                    className="overlay-buy-btn"
                  >
                    🛍️ 자세히 보기
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
        <div ref={chatPaneRef} className="liveroom-chat-pane" style={{ position: "relative" }}>
          {/* 장바구니 담기 토스트 */}
          {cartToasts.length > 0 && (
            <div className="cart-toast-container">
              {cartToasts.map((toast) => (
                <div key={toast.id} className="cart-toast-item">
                  🛒 <strong>{toast.nickname}</strong>님이 <strong>{toast.productName}</strong>을(를) 장바구니에 담았습니다!
                </div>
              ))}
            </div>
          )}
          <div className="chat-header">
            <h3>실시간 채팅</h3>
          </div>

          {/* 호스트 핀 공지 */}
          {stream.pinnedMessage && (
            <div className="chat-pinned-banner">
              <span className="chat-pinned-icon">📌</span>
              <span className="chat-pinned-text">{stream.pinnedMessage}</span>
            </div>
          )}

          <div className="chat-messages-box">
            {chats.map((c) => (
              <div key={c.id} className="chat-msg-line">
                <span className={`chat-user-nick${c.nickname === "모델뷰티" ? " admin-official" : ""}`}>
                  {c.nickname === "모델뷰티" ? "📢 모델뷰티" : c.nickname}
                </span>
                <span className={`chat-user-text${c.nickname === "모델뷰티" ? " admin-official" : ""}`}>
                  {renderChatMessage(c.message, stream.products, handleOpenPanel)}
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

      {/* 슬라이드업 상품 패널 */}
      {showProductPanel && (
        <>
          {/* 배경 딤 */}
          <div className="panel-backdrop" onClick={handleClosePanel} />
          <div className="product-slide-panel">
            {/* 드래그 핸들 + 닫기 */}
            <div className="panel-header">
              <div className="panel-drag-handle" />
              <button className="panel-close-btn" onClick={handleClosePanel}>✕</button>
            </div>

            {panelLoading || !panelProduct ? (
              // 스켈레톤 로딩
              <div className="panel-skeleton">
                <div className="skel skel-image" />
                <div style={{ flex: 1 }}>
                  <div className="skel skel-title" />
                  <div className="skel skel-price" />
                  <div className="skel skel-desc" />
                </div>
              </div>
            ) : (
              <div className="panel-content">
                {/* 상품 이미지 + 정보 */}
                <div className="panel-product-top">
                  <div className="panel-product-image">
                    {pimg(panelProduct) ? (
                      <Image
                        src={pimg(panelProduct)!}
                        alt={panelProduct.name}
                        fill
                        sizes="120px"
                        style={{ objectFit: "cover", borderRadius: "12px" }}
                      />
                    ) : (
                      <span style={{ fontSize: "2.5rem" }}>💄</span>
                    )}
                  </div>
                  <div className="panel-product-info">
                    <div className="panel-label">방송 소개 상품</div>
                    <div className="panel-product-name">{panelProduct.name}</div>
                    <div className="panel-product-price">
                      {panelProduct.salePrice ? (
                        <>
                          <span className="panel-sale-price">{panelProduct.salePrice.toLocaleString()}원</span>
                          <span className="panel-base-price-strike">{panelProduct.basePrice.toLocaleString()}원</span>
                        </>
                      ) : (
                        <span className="panel-sale-price">{panelProduct.basePrice.toLocaleString()}원</span>
                      )}
                    </div>
                    {(isActiveLiveDeal(panelProduct) || isSoldOut(panelProduct) || isLowStock(panelProduct) || (panelProduct.soldCount ?? 0) > 0) && (
                      <div className="overlay-prod-badges" style={{ marginTop: "0.5rem" }}>
                        {isActiveLiveDeal(panelProduct) && (
                          <span className="live-urgency-badge deal">
                            ⚡ 라이브특가{panelProduct.dealEndsAt ? ` · ${formatDealCountdown(panelProduct.dealEndsAt)}` : ""}
                          </span>
                        )}
                        {isSoldOut(panelProduct) ? (
                          <span className="live-urgency-badge soldout">품절</span>
                        ) : isLowStock(panelProduct) ? (
                          <span className="live-urgency-badge lowstock">🔥 품절임박 {panelProduct.stockQuantity}개</span>
                        ) : null}
                        {(panelProduct.soldCount ?? 0) > 0 && (
                          <span className="live-urgency-badge sold">🛒 실시간 {panelProduct.soldCount}개 판매</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 상품 설명 */}
                {panelProduct.description && (
                  <p className="panel-description">{panelProduct.description}</p>
                )}

                <p className="panel-size-note">💡 사이즈 및 옵션은 결제 직전 선택하실 수 있습니다.</p>

                {/* CTA 버튼 영역 */}
                {isLoggedIn ? (
                  <div className="panel-cta-area">
                    <button
                      className="panel-cart-btn"
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                    >
                      {addingToCart ? "담는 중..." : "❤️ 장바구니 담기"}
                    </button>
                    <a
                      href={`/products/${panelProduct.slug}?stream_id=${stream.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="panel-detail-btn"
                    >
                      상품 전체 보기 →
                    </a>
                  </div>
                ) : (
                  // 비로그인 유도 영역
                  <div className="panel-login-prompt">
                    <div className="panel-login-icon">🔒</div>
                    <p className="panel-login-text">방송 중 쇼핑을 위해<br />로그인이 필요합니다</p>
                    <a
                      href={`/login?redirect=/live/${stream.id}`}
                      className="panel-login-btn"
                    >
                      로그인하기
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 전체 상품 목록 바텀시트 */}
      {showProductList && (
        <>
          <div className="panel-backdrop" onClick={() => setShowProductList(false)} />
          <div className="product-slide-panel product-list-panel">
            <div className="panel-header">
              <div className="panel-drag-handle" />
              <button className="panel-close-btn" onClick={() => setShowProductList(false)}>✕</button>
            </div>
            <div className="panel-content">
              <div className="panel-label" style={{ marginBottom: "0.75rem" }}>
                이 방송의 상품 {stream.products.length}개
              </div>
              <div className="product-list-scroll">
                {stream.products.map((p) => (
                  <button
                    key={p.id}
                    className="product-list-row"
                    onClick={() => {
                      setShowProductList(false);
                      handleOpenPanel(p);
                    }}
                  >
                    <div className="product-list-row-image">
                      {pimg(p) ? (
                        <Image src={pimg(p)!} alt={p.name} fill sizes="48px" style={{ objectFit: "cover" }} />
                      ) : (
                        "💄"
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="product-list-row-name">{p.name}</div>
                      <div className="product-list-row-price">
                        {p.salePrice ? (
                          <>
                            <span className="panel-sale-price" style={{ fontSize: "0.9375rem" }}>{p.salePrice.toLocaleString()}원</span>
                            <span className="panel-base-price-strike" style={{ marginLeft: "0.375rem" }}>{p.basePrice.toLocaleString()}원</span>
                          </>
                        ) : (
                          <span className="panel-sale-price" style={{ fontSize: "0.9375rem" }}>{p.basePrice.toLocaleString()}원</span>
                        )}
                      </div>
                      {(isActiveLiveDeal(p) || isSoldOut(p) || isLowStock(p) || (p.soldCount ?? 0) > 0) && (
                        <div className="overlay-prod-badges">
                          {isActiveLiveDeal(p) && <span className="live-urgency-badge deal">⚡ 라이브특가</span>}
                          {isSoldOut(p) ? (
                            <span className="live-urgency-badge soldout">품절</span>
                          ) : isLowStock(p) ? (
                            <span className="live-urgency-badge lowstock">🔥 품절임박</span>
                          ) : null}
                          {(p.soldCount ?? 0) > 0 && (
                            <span className="live-urgency-badge sold">🛒 {p.soldCount}개 판매</span>
                          )}
                        </div>
                      )}
                    </div>
                    {p.id === activeProduct?.id && <span className="product-list-row-live">LIVE 소개중</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

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

        .overlay-product-list-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .overlay-product-list-btn:hover {
          background: rgba(0,0,0,0.75);
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

        .overlay-prod-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3125rem;
          margin-top: 0.375rem;
        }

        .live-urgency-badge {
          display: inline-flex;
          align-items: center;
          font-size: 0.625rem;
          font-weight: 800;
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
        }
        .live-urgency-badge.deal {
          background: rgba(251, 191, 36, 0.18);
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.4);
        }
        .live-urgency-badge.lowstock {
          background: rgba(239, 68, 68, 0.18);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }
        .live-urgency-badge.soldout {
          background: rgba(255,255,255,0.1);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.2);
        }
        .live-urgency-badge.sold {
          background: rgba(236, 72, 153, 0.18);
          color: #f472b6;
          border: 1px solid rgba(236, 72, 153, 0.4);
        }

        .chat-mention-chip {
          display: inline;
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          color: var(--mb-pink-400, #f472b6);
          font-weight: 800;
          cursor: pointer;
          font: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
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
          right: 0.5rem;
          width: 120px;
          height: 380px;
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

        .chat-pinned-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0.75rem 1.5rem 0;
          padding: 0.625rem 0.875rem;
          background: rgba(236, 72, 153, 0.1);
          border: 1px solid rgba(236, 72, 153, 0.25);
          border-radius: 10px;
        }
        .chat-pinned-icon {
          flex-shrink: 0;
          font-size: 0.875rem;
        }
        .chat-pinned-text {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #fbcfe8;
          line-height: 1.4;
          word-break: break-word;
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
            transform: translateY(-350px) scale(1.2);
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

        /* ── 슬라이드업 패널 ─────────────────────────────────── */
        .panel-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 200;
          backdrop-filter: blur(2px);
        }
        .product-slide-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 78vh;
          background: #1e293b;
          border-radius: 24px 24px 0 0;
          z-index: 201;
          box-shadow: 0 -10px 60px rgba(0, 0, 0, 0.6);
          animation: slideUpPanel 0.32s cubic-bezier(0.32, 0.72, 0, 1);
          overflow-y: auto;
          padding-bottom: env(safe-area-inset-bottom, 1.5rem);
        }
        @keyframes slideUpPanel {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem 1.5rem 0.5rem;
          position: relative;
        }
        .panel-drag-handle {
          width: 40px;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.2);
        }
        .panel-close-btn {
          position: absolute;
          right: 1.25rem;
          top: 0.75rem;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          color: #94a3b8;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .panel-close-btn:hover { background: rgba(255,255,255,0.15); }

        .panel-content {
          padding: 1rem 1.5rem 2rem;
        }
        .panel-product-top {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .panel-product-image {
          width: 100px;
          height: 100px;
          border-radius: 12px;
          background: #334155;
          flex-shrink: 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .panel-product-info {
          flex: 1;
          min-width: 0;
        }
        .panel-label {
          font-size: 0.6875rem;
          color: #db2777;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }
        .panel-product-name {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #f1f5f9;
          line-height: 1.3;
          margin-bottom: 0.5rem;
        }
        .panel-product-price {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }
        .panel-sale-price {
          font-size: 1.25rem;
          font-weight: 900;
          color: #f43f5e;
        }
        .panel-base-price-strike {
          font-size: 0.8125rem;
          color: #64748b;
          text-decoration: line-through;
        }

        /* 전체 상품 목록 바텀시트 */
        .product-list-panel {
          max-height: 82vh;
          display: flex;
          flex-direction: column;
        }
        .product-list-scroll {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          overflow-y: auto;
        }
        .product-list-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 0.75rem;
          cursor: pointer;
          text-align: left;
          font: inherit;
          color: inherit;
          transition: background 0.15s;
        }
        .product-list-row:hover {
          background: rgba(255,255,255,0.06);
        }
        .product-list-row-image {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 10px;
          overflow: hidden;
          background: #334155;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .product-list-row-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #f1f5f9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .product-list-row-live {
          flex-shrink: 0;
          font-size: 0.625rem;
          font-weight: 800;
          color: #db2777;
          background: rgba(219,39,119,0.15);
          border: 1px solid rgba(219,39,119,0.35);
          padding: 0.1875rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
        }
        .panel-description {
          font-size: 0.875rem;
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 0.75rem;
        }
        .panel-size-note {
          font-size: 0.75rem;
          color: #64748b;
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          margin-bottom: 1.25rem;
        }
        .panel-cta-area {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }
        .panel-cart-btn {
          width: 100%;
          padding: 0.9375rem;
          background: linear-gradient(135deg, #db2777 0%, #7c3aed 100%);
          color: #fff;
          font-size: 1rem;
          font-weight: 800;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          letter-spacing: -0.01em;
        }
        .panel-cart-btn:hover { opacity: 0.9; }
        .panel-cart-btn:active { transform: scale(0.98); }
        .panel-cart-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .panel-detail-btn {
          display: block;
          text-align: center;
          padding: 0.75rem;
          background: transparent;
          color: #94a3b8;
          font-size: 0.875rem;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          text-decoration: none;
          transition: background 0.15s;
        }
        .panel-detail-btn:hover { background: rgba(255,255,255,0.05); }

        /* 비로그인 유도 */
        .panel-login-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.07);
          text-align: center;
        }
        .panel-login-icon { font-size: 2rem; }
        .panel-login-text {
          font-size: 0.9rem;
          color: #94a3b8;
          line-height: 1.6;
        }
        .panel-login-btn {
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #db2777 0%, #7c3aed 100%);
          color: #fff;
          font-weight: 700;
          font-size: 0.9375rem;
          border-radius: 9999px;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .panel-login-btn:hover { opacity: 0.85; }

        /* 스켈레톤 */
        .panel-skeleton {
          display: flex;
          gap: 1rem;
          padding: 1.25rem 1.5rem 2rem;
        }
        .skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        .skel-image { width: 100px; height: 100px; flex-shrink: 0; border-radius: 12px; }
        .skel-title { height: 20px; width: 70%; margin-bottom: 8px; }
        .skel-price { height: 24px; width: 40%; margin-bottom: 10px; }
        .skel-desc { height: 14px; width: 90%; }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        /* ── 채팅창 상단 토스트 ─────────────────────────────────── */
        .cart-toast-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 0.5rem 0.75rem 0;
          pointer-events: none;
        }
        .cart-toast-item {
          background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
          color: #fff;
          padding: 0.5rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
          animation: toastIn 0.3s ease-out, toastOut 0.4s ease-in 3.1s forwards;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-8px); }
        }

        @media (max-width: 768px) {
          /* ── 모바일 전용 레이아웃: 비디오 sticky 고정 + 채팅 독립 스크롤 ── */

          .liveroom-root {
            padding: 0;
            min-height: 100dvh;
            align-items: flex-start;
          }

          .liveroom-container {
            flex-direction: column;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            overflow: hidden;
          }

          /* 비디오 패널: sticky로 상단 고정 */
          .liveroom-video-pane {
            flex: none;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            position: sticky;
            top: 0;
            z-index: 10;
            /* 영상 높이를 화면의 42%로 제한 */
            height: 42dvh;
            min-height: 200px;
            max-height: 280px;
          }

          /* 비디오 래퍼는 남은 공간 모두 차지 (stream-detail-info 제외) */
          .liveroom-video-pane .video-player-wrapper {
            flex: 1;
            min-height: 0;
          }

          /* 스트리머 정보: 컴팩트하게 */
          .stream-detail-info {
            padding: 0.5rem 1rem;
            flex-shrink: 0;
          }
          .stream-streamer-avatar {
            width: 30px;
            height: 30px;
            font-size: 1.1rem;
          }
          .streamer-name {
            font-size: 0.8125rem;
          }
          .stream-description {
            font-size: 0.75rem;
            margin-top: 1px;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          /* 채팅 패널: 남은 전체 높이 사용, 내부 스크롤 */
          .liveroom-chat-pane {
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          /* 채팅 메시지 영역: flex로 남은 공간 채움 */
          .chat-messages-box {
            flex: 1;
            height: auto;
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding: 0.75rem 1rem;
          }

          /* 채팅 입력란: 패널 하단에 sticky */
          .chat-input-bar {
            flex-shrink: 0;
            position: sticky;
            bottom: 0;
            padding: 0.625rem 0.875rem;
            padding-bottom: max(0.625rem, env(safe-area-inset-bottom));
            z-index: 20;
          }

          /* 채팅 헤더: 컴팩트 */
          .chat-header {
            padding: 0.625rem 1rem;
            flex-shrink: 0;
          }
          .chat-header h3 {
            font-size: 0.8125rem;
          }

          /* 상품 오버레이: 모바일 전체 너비 */
          .floating-live-product-wrap {
            width: calc(100% - 1.5rem);
            left: 0.75rem;
            bottom: 0.75rem;
          }
          .featured-product-overlay-card {
            width: 100%;
          }

          /* 좋아요 버튼: 비디오 영역 내 위치 조정 */
          .floating-like-btn {
            bottom: 0.75rem;
            right: 0.75rem;
            width: 40px;
            height: 40px;
            font-size: 1.25rem;
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

// 헬퍼: 재고/판매량/라이브특가 뱃지 계산
function isLowStock(prod: Product) {
  return typeof prod.stockQuantity === "number" && prod.stockQuantity > 0 && prod.stockQuantity <= LOW_STOCK_THRESHOLD;
}
function isSoldOut(prod: Product) {
  return typeof prod.stockQuantity === "number" && prod.stockQuantity <= 0;
}
function isActiveLiveDeal(prod: Product) {
  if (!prod.isLiveDeal) return false;
  if (!prod.dealEndsAt) return true;
  return new Date(prod.dealEndsAt).getTime() > Date.now();
}
function formatDealCountdown(dealEndsAt: string): string {
  const diff = new Date(dealEndsAt).getTime() - Date.now();
  if (diff <= 0) return "마감";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 남음`;
  const hours = Math.floor(mins / 60);
  return `${hours}시간 ${mins % 60}분 남음`;
}

// 헬퍼: 채팅 메시지에서 "#상품명" 언급을 클릭 가능한 하이라이트로 변환
function renderChatMessage(text: string, products: Product[], onMention: (p: Product) => void) {
  if (products.length === 0) return text;
  const names = products.map((p) => p.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`#(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const prod = products.find((p) => p.name === part);
    if (prod) {
      return (
        <button
          key={i}
          type="button"
          className="chat-mention-chip"
          onClick={() => onMention(prod)}
        >
          #{part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
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

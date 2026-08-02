"use client";
// ============================================================
// ShareButtons — 상품 상세 페이지 공유 버튼 (Client Component)
// 링크 복사 / 카카오톡 공유 / Web Share API 3종 지원
// ============================================================

import { useEffect, useState, useCallback } from "react";

// Kakao SDK 타입 선언 (글로벌 window 객체에 주입됨)
declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

interface ShareButtonsProps {
  productName: string;
  productUrl: string;         // 전체 URL (https://...)
  thumbnailUrl?: string;
  description?: string | null;
  crewNickname?: string | null;
  recommendationNote?: string | null;
}

export default function ShareButtons({
  productName,
  productUrl,
  thumbnailUrl,
  description,
  crewNickname,
  recommendationNote,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [nativeShareSupported, setNativeShareSupported] = useState(false);

  // OS 공유시트(navigator.share) 지원 여부 — 미지원 환경(대부분의 데스크톱)에서는
  // "더 보내기"가 링크 복사와 동일하게 동작해 버튼이 중복되므로 아예 숨긴다.
  useEffect(() => {
    setNativeShareSupported(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // 카카오 SDK 초기화
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) return;

    const initKakao = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(key);
        setKakaoReady(true);
      } else if (window.Kakao?.isInitialized()) {
        setKakaoReady(true);
      }
    };

    // SDK가 이미 로드된 경우
    if (window.Kakao) {
      initKakao();
      return;
    }

    // SDK 동적 로드
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.integrity = "sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = initKakao;
    document.head.appendChild(script);
  }, []);

  // 링크 복사
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = productUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [productUrl]);

  // 카카오톡 공유
  const handleKakao = useCallback(() => {
    if (!window.Kakao?.Share) return;

    // 크루가 있으면 추천 문구 포함
    const shareDesc = crewNickname
      ? `${crewNickname}님 추천${recommendationNote ? ` — "${recommendationNote}"` : ""}`
      : (description ?? "모델뷰티에서 만나보세요.");

    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: `${productName} | 모델뷰티`,
        description: shareDesc,
        imageUrl: thumbnailUrl ?? "https://www.modelbeauty.kr/og-image.png",
        link: {
          mobileWebUrl: productUrl,
          webUrl: productUrl,
        },
      },
      buttons: [
        {
          title: "지금 구매하기",
          link: {
            mobileWebUrl: productUrl,
            webUrl: productUrl,
          },
        },
      ],
    });
  }, [productName, productUrl, thumbnailUrl, description, crewNickname, recommendationNote]);

  // Web Share API (모바일 OS 공유 시트)
  const handleWebShare = useCallback(async () => {
    const shareDesc = crewNickname
      ? `${crewNickname}님 추천 — ${productName} | 모델뷰티`
      : `${productName} | 모델뷰티`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareDesc,
          url: productUrl,
        });
      } catch {
        // 사용자가 취소한 경우 등 무시
      }
    } else {
      // Web Share 미지원 환경에서는 링크 복사 fallback
      handleCopy();
    }
  }, [productName, productUrl, crewNickname, handleCopy]);

  return (
    <div style={{ padding: "1rem 0" }}>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--mb-gray-500, #6b7280)",
          fontWeight: 500,
          margin: "0 0 0.625rem",
        }}
      >
        공유하기
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {/* 카카오톡 공유 — 국내 주 채널이라 가장 넓게, 항상 맨 앞에 노출 */}
        {kakaoReady && (
          <button
            onClick={handleKakao}
            title="카카오톡으로 공유"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              flex: 1,
              padding: "0.625rem 1rem",
              background: "#FEE500",
              color: "#191919",
              border: "none",
              borderRadius: "999px",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "filter 0.2s",
              fontFamily: "inherit",
            }}
          >
            💬 카카오톡 공유
          </button>
        )}

        {/* 링크 복사 (아이콘 버튼) */}
        <button
          onClick={handleCopy}
          title="링크 복사"
          aria-label={copied ? "링크가 복사되었습니다" : "링크 복사"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "42px",
            height: "42px",
            flexShrink: 0,
            background: copied ? "#d1fae5" : "#f3f4f6",
            color: copied ? "#065f46" : "#374151",
            border: "none",
            borderRadius: "50%",
            fontSize: "1rem",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          {copied ? "✅" : "🔗"}
        </button>

        {/* 더 보내기 — OS 공유시트가 실제로 있는 환경(주로 모바일)에서만 노출.
            없는 환경에서는 링크 복사와 동작이 겹쳐 중복 버튼이 되므로 숨김. */}
        {nativeShareSupported && (
          <button
            onClick={handleWebShare}
            title="더 보내기"
            aria-label="더 보내기"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "42px",
              height: "42px",
              flexShrink: 0,
              background: "#f3f4f6",
              color: "#374151",
              border: "none",
              borderRadius: "50%",
              fontSize: "1rem",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            📤
          </button>
        )}
      </div>
    </div>
  );
}

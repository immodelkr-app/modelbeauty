import { isAppWebView } from "./webview";

interface AndroidPushNative {
  getToken(): string;
}

declare global {
  interface Window {
    AndroidPush?: AndroidPushNative;
    __onFcmToken?: (token: string) => void;
  }
}

/** 푸시 브릿지(네이티브 앱)를 사용할 수 있는 환경인지 확인 */
export function isPushBridgeAvailable(): boolean {
  return isAppWebView() && typeof window !== "undefined" && !!window.AndroidPush;
}

/**
 * 네이티브에 저장된 FCM 토큰을 가져온다.
 * 앱 실행 초반에는 아직 토큰이 발급되지 않았을 수 있어(getToken()이 빈 문자열),
 * 이후 네이티브가 window.__onFcmToken(token)을 호출하면 그 값을 받는다.
 */
export function getNativeFcmToken(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isPushBridgeAvailable()) {
      resolve(null);
      return;
    }
    const existing = window.AndroidPush!.getToken();
    if (existing) {
      resolve(existing);
      return;
    }
    // 아직 토큰이 없으면 네이티브가 발급 즉시 알려줄 때까지 대기 (최대 10초)
    const timer = setTimeout(() => {
      window.__onFcmToken = undefined;
      resolve(null);
    }, 10000);
    window.__onFcmToken = (token: string) => {
      clearTimeout(timer);
      window.__onFcmToken = undefined;
      resolve(token || null);
    };
  });
}

/**
 * 앱(WebView) 안에서 실행 중이면 FCM 토큰을 받아 서버에 등록/갱신한다.
 * 로그인 여부와 무관하게 호출 가능 — 서버가 현재 세션 쿠키로 회원 연결 여부를 판단한다.
 */
export async function syncPushToken(): Promise<void> {
  if (!isPushBridgeAvailable()) return;
  try {
    const token = await getNativeFcmToken();
    if (!token) return;
    await fetch("/api/push/register-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: "android" }),
    });
  } catch {
    // 네트워크 오류 등은 조용히 무시 — 다음 세션 체크 때 재시도됨
  }
}

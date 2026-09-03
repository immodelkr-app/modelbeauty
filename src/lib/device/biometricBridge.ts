import { isAppWebView } from "./webview";

interface AndroidBiometricNative {
  checkAvailability(): string;
  saveCredential(refreshToken: string): void;
  syncCredential(refreshToken: string): void;
  login(): void;
  clearCredential(): void;
}

declare global {
  interface Window {
    AndroidBiometric?: AndroidBiometricNative;
    __onBiometricEnrollResult?: (success: boolean, message: string) => void;
    __onBiometricLoginResult?: (success: boolean, token: string | null, message: string) => void;
  }
}

export interface BiometricAvailability {
  hardwareAvailable: boolean;
  credentialSaved: boolean;
}

/** 지문 로그인 브릿지(네이티브 앱)를 사용할 수 있는 환경인지 확인 */
export function isBiometricBridgeAvailable(): boolean {
  return isAppWebView() && typeof window !== "undefined" && !!window.AndroidBiometric;
}

/** 기기의 지문 하드웨어 여부 + 앱에 저장된 지문 로그인 자격증명 존재 여부 조회 */
export function checkBiometricAvailability(): BiometricAvailability {
  if (!isBiometricBridgeAvailable()) {
    return { hardwareAvailable: false, credentialSaved: false };
  }
  try {
    const raw = window.AndroidBiometric!.checkAvailability();
    const parsed = JSON.parse(raw);
    return {
      hardwareAvailable: !!parsed.hardwareAvailable,
      credentialSaved: !!parsed.credentialSaved,
    };
  } catch {
    return { hardwareAvailable: false, credentialSaved: false };
  }
}

/** 현재 세션의 refresh token을 지문으로 보호해 기기에 저장(등록) */
export function enrollBiometricLogin(refreshToken: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (!isBiometricBridgeAvailable()) {
      resolve({ success: false, message: "not_available" });
      return;
    }
    window.__onBiometricEnrollResult = (success, message) => {
      window.__onBiometricEnrollResult = undefined;
      resolve({ success, message });
    };
    window.AndroidBiometric!.saveCredential(refreshToken);
  });
}

/** 지문 인증 후 저장된 refresh token을 복호화해 받아옴 */
export function loginWithBiometric(): Promise<{ success: boolean; token: string | null; message: string }> {
  return new Promise((resolve) => {
    if (!isBiometricBridgeAvailable()) {
      resolve({ success: false, token: null, message: "not_available" });
      return;
    }
    window.__onBiometricLoginResult = (success, token, message) => {
      window.__onBiometricLoginResult = undefined;
      resolve({ success, token, message });
    };
    window.AndroidBiometric!.login();
  });
}

/**
 * 이미 등록된 기기에서만, 지문 인증 없이 저장된 refresh token을 최신 값으로 조용히 동기화.
 * Supabase 세션이 백그라운드에서 자동 갱신될 때마다 호출해 저장된 토큰이 만료되는 것을 막는다
 * (등록 자체가 안 되어 있으면 네이티브 쪽에서 아무 것도 하지 않는다).
 */
export function syncBiometricCredential(refreshToken: string): void {
  if (!isBiometricBridgeAvailable()) return;
  try {
    window.AndroidBiometric!.syncCredential(refreshToken);
  } catch {
    // 동기화 실패는 조용히 무시 — 다음 지문 로그인 시도에서 만료로 감지되어 재등록을 유도한다
  }
}

/** 지문 로그인 자격증명 삭제 (마이페이지에서 끄거나, 만료된 토큰 감지 시) */
export function clearBiometricCredential(): void {
  if (!isBiometricBridgeAvailable()) return;
  window.AndroidBiometric!.clearCredential();
}

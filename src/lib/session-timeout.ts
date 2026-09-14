// ============================================================
// 세션 유효시간 관리
// 1) 절대 만료: 로그인 후 3시간이 지나면 무조건 자동 로그아웃
//    (라이브 방송 시청처럼 조작 없이 화면만 보고 있는 경우 대비)
// 2) 유휴 만료: 화면 조작(클릭/터치/키입력/스크롤)이 없는 상태로
//    IDLE_MAX_MS(기본 1시간 30분)가 지나면 자동 로그아웃
//
// 로그인 시각 기록은 실제 Supabase 인증 세션과 동일하게 "쿠키"에 저장한다.
// (localStorage에 저장했을 때, 브라우저의 사이트 데이터 정리 정책 등으로
//  로그인 세션 쿠키는 살아있는데 이 기록만 사라지면 "방금 로그인한 것"으로
//  오인해 3시간 타이머가 조용히 리셋되어 로그아웃이 걸리지 않는 문제가 있었음)
// ============================================================

const LOGIN_AT_KEY = "mb_login_at";
const LAST_ACTIVITY_KEY = "mb_last_activity_at";
const COOKIE_MAX_AGE_SEC = 400 * 24 * 60 * 60; // 브라우저 쿠키 만료 상한(400일) — 실질적으로 세션 쿠키와 동행

function setCookie(key: string, value: string) {
  try {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${key}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    // 접근 불가 환경(프라이빗 모드 등) 무시
  }
}

function getCookie(key: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function removeCookie(key: string) {
  try {
    document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // 무시
  }
}

export const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3시간 (절대 만료)
export const IDLE_MAX_MS = 90 * 60 * 1000; // 1시간 30분 (유휴 만료, 1~2시간 범위)

export function markLoginAt(timestamp: number = Date.now()) {
  setCookie(LOGIN_AT_KEY, String(timestamp));
}

export function getLoginAt(): number | null {
  const raw = getCookie(LOGIN_AT_KEY);
  return raw ? Number(raw) : null;
}

export function clearLoginAt() {
  removeCookie(LOGIN_AT_KEY);
  removeCookie(LAST_ACTIVITY_KEY);
}

export function isSessionExpired(): boolean {
  const loginAt = getLoginAt();
  if (!loginAt) return false;
  return Date.now() - loginAt > SESSION_MAX_AGE_MS;
}

export function markActivity(timestamp: number = Date.now()) {
  setCookie(LAST_ACTIVITY_KEY, String(timestamp));
}

export function getLastActivityAt(): number | null {
  const raw = getCookie(LAST_ACTIVITY_KEY);
  return raw ? Number(raw) : null;
}

export function isIdleExpired(): boolean {
  // 활동 기록이 없으면(막 로그인 직후 등) 로그인 시각을 기준으로 판단
  const lastActivity = getLastActivityAt() ?? getLoginAt();
  if (!lastActivity) return false;
  return Date.now() - lastActivity > IDLE_MAX_MS;
}

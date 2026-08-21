// ============================================================
// 세션 유효시간 관리 — 로그인 후 3시간이 지나면 자동 로그아웃
// 라이브 방송 시청처럼 조작 없이 화면만 보고 있는 경우가 많아
// "유휴시간"이 아닌 "로그인 후 경과시간" 기준의 절대 만료로 처리한다.
// ============================================================

const LOGIN_AT_KEY = "mb_login_at";
export const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3시간

export function markLoginAt(timestamp: number = Date.now()) {
  try {
    localStorage.setItem(LOGIN_AT_KEY, String(timestamp));
  } catch {
    // 접근 불가 환경(프라이빗 모드 등) 무시
  }
}

export function getLoginAt(): number | null {
  try {
    const raw = localStorage.getItem(LOGIN_AT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function clearLoginAt() {
  try {
    localStorage.removeItem(LOGIN_AT_KEY);
  } catch {
    // 무시
  }
}

export function isSessionExpired(): boolean {
  const loginAt = getLoginAt();
  if (!loginAt) return false;
  return Date.now() - loginAt > SESSION_MAX_AGE_MS;
}

// ============================================================
// 세션 유효시간 관리
// 1) 절대 만료: 로그인 후 3시간이 지나면 무조건 자동 로그아웃
//    (라이브 방송 시청처럼 조작 없이 화면만 보고 있는 경우 대비)
// 2) 유휴 만료: 화면 조작(클릭/터치/키입력/스크롤)이 없는 상태로
//    IDLE_MAX_MS(기본 1시간 30분)가 지나면 자동 로그아웃
// ============================================================

const LOGIN_AT_KEY = "mb_login_at";
const LAST_ACTIVITY_KEY = "mb_last_activity_at";

export const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3시간 (절대 만료)
export const IDLE_MAX_MS = 90 * 60 * 1000; // 1시간 30분 (유휴 만료, 1~2시간 범위)

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
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // 무시
  }
}

export function isSessionExpired(): boolean {
  const loginAt = getLoginAt();
  if (!loginAt) return false;
  return Date.now() - loginAt > SESSION_MAX_AGE_MS;
}

export function markActivity(timestamp: number = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
  } catch {
    // 접근 불가 환경(프라이빗 모드 등) 무시
  }
}

export function getLastActivityAt(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function isIdleExpired(): boolean {
  // 활동 기록이 없으면(막 로그인 직후 등) 로그인 시각을 기준으로 판단
  const lastActivity = getLastActivityAt() ?? getLoginAt();
  if (!lastActivity) return false;
  return Date.now() - lastActivity > IDLE_MAX_MS;
}

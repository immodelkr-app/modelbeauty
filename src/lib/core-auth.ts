// ============================================================
// im-core-auth 연동 헬퍼
// 모든 서버-서버 통신은 x-api-secret 헤더로 인증
// ============================================================

import type { AppName, AvailableCoupon, MasterUser, PointBalance } from "@/types";

const CORE_AUTH_URL = process.env.IM_CORE_AUTH_URL!;
const CORE_AUTH_SECRET = process.env.IM_CORE_AUTH_SECRET!;

/**
 * im-core-auth API 호출 기본 함수
 */
async function coreAuthFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${CORE_AUTH_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-secret": CORE_AUTH_SECRET,
      ...options.headers,
    },
  });
}

// ── SSO 동기화 ──────────────────────────────────────────────

/**
 * 전화번호로 마스터 유저 생성/연결 (SSO 핵심)
 * 모델뷰티 앱 로그인 시 호출
 */
export async function syncMasterUser(params: {
  phoneNumber: string;
  appName: AppName;
  localUserId: string;
  name?: string;
  realName?: string;
  nickname?: string;
}): Promise<MasterUser> {
  const res = await coreAuthFetch("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `im-core-auth sync 실패: ${res.status}`);
  }

  const data = await res.json();
  return data as MasterUser;
}

/**
 * 닉네임 사용 가능 여부 확인 (im-core-auth 통합 DB 조회)
 * 회원가입 시 실시간 중복 확인용
 */
export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const res = await coreAuthFetch(
    `/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`
  );
  if (!res.ok) return false;
  const data = await res.json();
  return data.available === true;
}

/**
 * 닉네임으로 마스터 유저 조회
 * 로그인 시 닉네임 → 휴대폰번호 변환용
 */
export async function getMasterUserByNickname(
  nickname: string
): Promise<{ masterUserId: string; phoneNumber: string } | null> {
  const res = await coreAuthFetch(
    `/api/auth/user/nickname/${encodeURIComponent(nickname)}`
  );
  if (res.status === 200) {
    const data = await res.json();
    if (data.found) {
      return { masterUserId: data.masterUserId, phoneNumber: data.phoneNumber };
    }
  }
  return null;
}

/**
 * 실명 + 휴대폰번호로 닉네임 찾기
 */
export async function findNicknameByRealNameAndPhone(
  realName: string,
  phoneNumber: string
): Promise<string | null> {
  const res = await coreAuthFetch("/api/auth/find-nickname", {
    method: "POST",
    body: JSON.stringify({ realName, phoneNumber }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.found ? data.nickname : null;
}

/**
 * 비밀번호 재설정 전 본인 확인
 * 닉네임 + 실명 + 휴대폰번호 일치 시 localUserId 반환
 */
export async function verifyUserIdentity(params: {
  nickname: string;
  realName: string;
  phoneNumber: string;
  appName: AppName;
}): Promise<{ localUserId: string; masterUserId: string; phoneNumber?: string; nickname?: string; realName?: string } | null> {
  const res = await coreAuthFetch("/api/auth/verify-user", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.found ? { 
    localUserId: data.localUserId, 
    masterUserId: data.masterUserId,
    phoneNumber: data.phoneNumber,
    nickname: data.nickname,
    realName: data.realName
  } : null;
}

/**
 * masterUserId로 마스터 유저 조회
 */
export async function getMasterUser(masterUserId: string): Promise<MasterUser> {
  const res = await coreAuthFetch(`/api/auth/user/${masterUserId}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `마스터 유저 조회 실패: ${res.status}`);
  }

  return res.json();
}

/**
 * 전화번호로 마스터 유저 조회
 */
export async function getMasterUserByPhone(
  phoneNumber: string
): Promise<MasterUser | null> {
  const res = await coreAuthFetch(`/api/auth/user/phone/${encodeURIComponent(phoneNumber)}`);

  if (res.status === 404) return null;

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `유저 조회 실패: ${res.status}`);
  }

  return res.json();
}

/**
 * 닉네임(name) 등 마스터 유저 정보 업데이트
 * 모든 연동 앱(모카, IMFF, 모델뷰티)에 즉시 반영됨
 */
export async function updateMasterUser(
  masterUserId: string,
  params: {
    name?: string;
    shipping_recipient?: string | null;
    shipping_phone?: string | null;
    shipping_zipcode?: string | null;
    shipping_address?: string | null;
    shipping_detail?: string | null;
  }
): Promise<MasterUser> {
  const res = await coreAuthFetch(`/api/auth/user/${masterUserId}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `유저 정보 업데이트 실패: ${res.status}`);
  }

  return res.json();
}


// ── 포인트 ────────────────────────────────────────────────

/**
 * 통합 포인트 잔액 조회
 */
export async function getPointBalance(
  masterUserId: string
): Promise<PointBalance> {
  const res = await coreAuthFetch(
    `/api/points/balance/${masterUserId}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `포인트 조회 실패: ${res.status}`);
  }

  return res.json();
}

/**
 * 포인트 적립 (구매 완료 후 적립금 지급 등)
 */
export async function rewardPoints(params: {
  masterUserId: string;
  amount: number;
  description?: string;
}): Promise<{ transactionId: string; newBalance: number }> {
  const res = await coreAuthFetch("/api/points/reward", {
    method: "POST",
    body: JSON.stringify({
      masterUserId: params.masterUserId,
      amount: params.amount,
      appName: "MODEL_BEAUTY",
      description: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `포인트 적립 실패: ${res.status}`);
  }

  return res.json();
}

/**
 * 포인트 차감 (주문 결제 시 사용)
 */
export async function deductPoints(params: {
  masterUserId: string;
  amount: number;
  description?: string;
}): Promise<{ transactionId: string; newBalance: number }> {
  const res = await coreAuthFetch("/api/points/deduct", {
    method: "POST",
    body: JSON.stringify({
      masterUserId: params.masterUserId,
      amount: params.amount,
      appName: "MODEL_BEAUTY",
      description: params.description,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `포인트 차감 실패: ${res.status}`);
  }

  return res.json();
}

// ── 쿠폰 ──────────────────────────────────────────────────

/**
 * 사용 가능한 쿠폰 목록 조회
 */
export async function getAvailableCoupons(
  masterUserId: string
): Promise<AvailableCoupon[]> {
  const res = await coreAuthFetch(
    `/api/coupons/available/${masterUserId}`
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `쿠폰 조회 실패: ${res.status}`);
  }

  const data = await res.json();
  return data.coupons ?? [];
}

/**
 * 쿠폰 사용 처리 (주문 결제 시)
 */
export async function useCoupon(
  userCouponId: string
): Promise<void> {
  const res = await coreAuthFetch(`/api/coupons/use/${userCouponId}`, {
    method: "PATCH",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `쿠폰 사용 처리 실패: ${res.status}`);
  }
}

/**
 * 쿠폰 복원 (환불 처리 시)
 */
export async function restoreCoupon(
  userCouponId: string
): Promise<void> {
  const res = await coreAuthFetch(`/api/coupons/restore/${userCouponId}`, {
    method: "PATCH",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `쿠폰 복원 실패: ${res.status}`);
  }
}

// ============================================================
// 토스페이먼츠(Toss Payments) 연동 헬퍼
// V2 API — 결제위젯 기반
// ============================================================

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const TOSS_API_BASE = "https://api.tosspayments.com/v1";

/**
 * 토스페이먼츠 API 기본 요청 함수
 * Basic 인증: base64(secretKey + ":")
 */
async function tossApiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const credentials = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

  return fetch(`${TOSS_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ── 결제 승인 ──────────────────────────────────────────────

export interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  status: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
  requestedAt: string;
  approvedAt: string;
  receipt?: {
    url: string;
  };
  card?: {
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    approveNo: string;
  };
}

/**
 * 결제 승인 — 프론트에서 성공 리다이렉트 후 서버에서 호출
 */
export async function confirmPayment(
  params: TossPaymentConfirmRequest
): Promise<TossPaymentResponse> {
  const res = await tossApiFetch("/payments/confirm", {
    method: "POST",
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.message || `토스페이먼츠 결제 승인 실패: ${res.status}`
    );
  }

  return data as TossPaymentResponse;
}

// ── 결제 취소 (환불) ───────────────────────────────────────

export interface TossCancelRequest {
  cancelReason: string;
  cancelAmount?: number;     // 부분 취소 시 금액, 없으면 전액 취소
  refundReceiveAccount?: {
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}

export interface TossCancelResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  cancels: Array<{
    cancelAmount: number;
    cancelReason: string;
    canceledAt: string;
    transactionKey: string;
  }>;
}

/**
 * 결제 취소 (전액 또는 부분 환불)
 */
export async function cancelPayment(
  paymentKey: string,
  params: TossCancelRequest
): Promise<TossCancelResponse> {
  const res = await tossApiFetch(`/payments/${paymentKey}/cancel`, {
    method: "POST",
    body: JSON.stringify(params),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.message || `토스페이먼츠 결제 취소 실패: ${res.status}`
    );
  }

  return data as TossCancelResponse;
}

// ── 결제 조회 ──────────────────────────────────────────────

/**
 * paymentKey로 결제 정보 조회
 */
export async function getPayment(
  paymentKey: string
): Promise<TossPaymentResponse> {
  const res = await tossApiFetch(`/payments/${paymentKey}`);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.message || `토스페이먼츠 결제 조회 실패: ${res.status}`
    );
  }

  return data as TossPaymentResponse;
}

/**
 * orderId로 결제 정보 조회
 */
export async function getPaymentByOrderId(
  orderId: string
): Promise<TossPaymentResponse> {
  const res = await tossApiFetch(`/payments/orders/${orderId}`);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data.message || `토스페이먼츠 결제 조회 실패: ${res.status}`
    );
  }

  return data as TossPaymentResponse;
}

// ── 유틸리티 ──────────────────────────────────────────────

/**
 * 주문번호 생성 — MB-YYYYMMDD-XXXX 형식
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MB-${dateStr}-${random}`;
}

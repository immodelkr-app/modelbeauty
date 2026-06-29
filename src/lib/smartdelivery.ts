// ============================================================
// 스마트택배(Smart Delivery) API 연동 헬퍼
// 택배사 자동 인식 + 실시간 배송 추적
// ============================================================

const SMART_DELIVERY_API_KEY = process.env.SMART_DELIVERY_API_KEY!;
const SMART_API_BASE = "https://info.sweettracker.co.kr/api/v1";

// ── 택배사 목록 ──────────────────────────────────────────

export interface Carrier {
  id: string;
  name: string;
}

/**
 * 지원 택배사 목록 조회
 */
export async function getCarriers(): Promise<Carrier[]> {
  const url = new URL(`${SMART_API_BASE}/companylist`);
  url.searchParams.set("t_key", SMART_DELIVERY_API_KEY);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`스마트택배 택배사 목록 조회 실패: ${res.status}`);
  }

  const data = await res.json();
  return data.Company ?? [];
}

// ── 배송 추적 ──────────────────────────────────────────────

export interface TrackingEvent {
  time: string;       // "2026-06-27 09:00:00"
  where: string;      // 위치/터미널명
  kind: string;       // 상태명 ("집화처리", "이동중" 등)
  level: string;      // 단계 (1~6)
  remark: string;     // 비고
  telno: string;      // 연락처
}

export interface TrackingResult {
  invoiceNo: string;
  companyName: string;
  complete: boolean;        // 배송 완료 여부
  level: number;            // 현재 단계 (1~6)
  lastStateMessage: string; // 최근 상태 메시지
  trackingDetails: TrackingEvent[];
}

/**
 * 송장번호로 배송 상태 조회
 * @param carrierId - 택배사 코드 (예: CJ대한통운: "04", 한진택배: "05")
 * @param trackingNumber - 송장번호
 */
export async function trackDelivery(
  carrierId: string,
  trackingNumber: string
): Promise<TrackingResult> {
  const url = new URL(`${SMART_API_BASE}/trackingInfo`);
  url.searchParams.set("t_key", SMART_DELIVERY_API_KEY);
  url.searchParams.set("t_code", carrierId);
  url.searchParams.set("t_invoice", trackingNumber);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`스마트택배 배송 조회 실패: ${res.status}`);
  }

  const data = await res.json();

  if (!data.result || data.result === "N") {
    throw new Error(data.msg || "배송 정보를 찾을 수 없습니다.");
  }

  return {
    invoiceNo: data.invoiceNo ?? trackingNumber,
    companyName: data.companyName ?? "",
    complete: data.complete === "Y",
    level: Number(data.level ?? 1),
    lastStateMessage: data.lastStateMessage ?? "",
    trackingDetails: (data.trackingDetails ?? []) as TrackingEvent[],
  };
}

// ── 택배사 코드 매핑 ──────────────────────────────────────

/** 자주 쓰이는 택배사 코드 상수 */
export const CARRIER_CODES = {
  CJ대한통운: "04",
  한진택배: "05",
  롯데택배: "08",
  우체국택배: "01",
  로젠택배: "06",
  GS25편의점택배: "26",
  KGB택배: "23",
  GTX로지스: "18",
} as const;

export type CarrierName = keyof typeof CARRIER_CODES;

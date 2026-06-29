// ============================================================
// lib/sweettracker.ts — 스마트택배(스윗트래커) API 클라이언트
// Base URL: https://info.sweettracker.co.kr
// Docs: https://info.sweettracker.co.kr/v2/api-docs
// ============================================================

const BASE_URL = "https://info.sweettracker.co.kr";
const API_KEY = process.env.SMART_DELIVERY_API_KEY ?? "";

// ── 택배사 코드 맵 (주요 국내 택배사) ──────────────────────

export const CARRIER_CODES: Record<string, string> = {
  "01": "우체국택배",
  "04": "CJ대한통운",
  "05": "한진택배",
  "06": "로젠택배",
  "08": "롯데택배",
  "11": "일양로지스",
  "12": "EMS",
  "13": "DHL",
  "14": "UPS",
  "16": "한의사랑택배",
  "17": "천일택배",
  "18": "건영택배",
  "21": "Fedex",
  "22": "대신택배",
  "23": "경동택배",
  "24": "GS Postbox 택배",
  "46": "CU편의점택배",
  "53": "농협택배",
  "54": "홈픽택배",
};

// ── 배송 단계 레이블 ────────────────────────────────────────

export const TRACKING_LEVELS: Record<number, { label: string; icon: string }> = {
  1: { label: "배송준비중", icon: "📋" },
  2: { label: "집화완료", icon: "📦" },
  3: { label: "배송중", icon: "🚚" },
  4: { label: "지점 도착", icon: "🏭" },
  5: { label: "배송출발", icon: "🏃" },
  6: { label: "배송완료", icon: "✅" },
};

// ── 타입 정의 ───────────────────────────────────────────────

export interface TrackingDetail {
  time: number;          // Unix timestamp (ms)
  timeString: string;    // "YYYYMMDDHHMMSS"
  where: string;         // 진행위치(지점)
  kind: string;          // 진행상태 텍스트
  level: number;         // 1~6
  remark: string | null; // 비고
  manName: string | null; // 배송기사 이름
  telno2: string | null;  // 배송기사 전화번호
  code: string | null;
}

export interface TrackingInfo {
  invoiceNo: string;
  itemName: string | null;
  receiverName: string | null;
  receiverAddr: string | null;
  senderName: string | null;
  level: number;          // 현재 단계 1~6
  complete: boolean;
  completeYN: "Y" | "N";
  estimate: string | null;
  trackingDetails: TrackingDetail[];
  firstDetail: TrackingDetail | null;
  lastStateDetail: TrackingDetail | null;
  result: string;
}

export interface TrackingResult {
  success: boolean;
  data?: TrackingInfo;
  error?: string;
  errorCode?: string;
}

// ── 배송 조회 메인 함수 ──────────────────────────────────────

/**
 * 스마트택배 API로 배송 정보를 실시간 조회합니다.
 * @param carrierCode 택배사 코드 (예: "04" = CJ대한통운)
 * @param trackingNumber 운송장 번호
 */
export async function fetchTrackingInfo(
  carrierCode: string,
  trackingNumber: string
): Promise<TrackingResult> {
  if (!API_KEY) {
    return {
      success: false,
      error: "스마트택배 API 키가 설정되지 않았습니다.",
      errorCode: "NO_API_KEY",
    };
  }

  const params = new URLSearchParams({
    t_key: API_KEY,
    t_code: carrierCode,
    t_invoice: trackingNumber,
  });

  try {
    const res = await fetch(`${BASE_URL}/api/v1/trackingInfo?${params}`, {
      headers: { Accept: "application/json;charset=UTF-8" },
      // 캐시 없이 항상 최신 정보
      cache: "no-store",
    });

    const body = await res.json();

    // 스윗트래커 오류 코드 처리 (HTTP 200이지만 내부 오류 포함)
    if (!res.ok || body.result === "E") {
      const code = String(body.code ?? res.status);
      const ERROR_MAP: Record<string, string> = {
        "101": "발급된 고유키가 존재하지 않습니다.",
        "102": "만료된 API 키입니다.",
        "103": "API 키 사용량이 초과되었습니다.",
        "104": "유효하지 않은 운송장 번호 또는 택배사 코드입니다.",
        "105": "동일한 운송장의 하루 요청 한도를 초과했습니다.",
        "106": "운송장 번호 조회 오류입니다.",
      };
      return {
        success: false,
        error: ERROR_MAP[code] ?? body.msg ?? "배송 조회에 실패했습니다.",
        errorCode: code,
      };
    }

    return { success: true, data: body as TrackingInfo };
  } catch (err) {
    console.error("[fetchTrackingInfo]", err);
    return {
      success: false,
      error: "배송 조회 서버에 연결할 수 없습니다.",
      errorCode: "NETWORK_ERROR",
    };
  }
}

// ── 택배사 목록 조회 ─────────────────────────────────────────

export async function fetchCarrierList(): Promise<
  { Code: string; Name: string; International: string }[]
> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/companylist?t_key=${API_KEY}`,
      { next: { revalidate: 3600 } } // 1시간 캐시
    );
    const data = await res.json();
    return data ?? [];
  } catch {
    return [];
  }
}

// ── timeString 파싱 헬퍼 ("20260629143000" → Date) ──────────

export function parseTrackingTime(timeString: string): Date | null {
  if (!timeString || timeString.length < 14) return null;
  const y = timeString.slice(0, 4);
  const mo = timeString.slice(4, 6);
  const d = timeString.slice(6, 8);
  const h = timeString.slice(8, 10);
  const mi = timeString.slice(10, 12);
  const s = timeString.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`);
}

export function formatTrackingTime(timeString: string): string {
  const date = parseTrackingTime(timeString);
  if (!date) return timeString;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
}

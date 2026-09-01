// ============================================================
// 솔라피 카카오톡 친구톡 발송 — "아임모델" 채널(PFID) 이용
// 친구톡은 알림톡과 달리 템플릿 사전 심사가 필요 없다 (자유 형식 메시지).
// 채널을 "친구추가"한 수신자에게만 실제 전달되며, 친구가 아니면 접수 단계에서
// 실패 처리된다 (disableSms: true로 문자 자동 대체 발송을 막아 불필요한 비용을 방지).
//
// 필요 환경변수 (기존 SMS 발송용 SOLAPI_API_KEY/SECRET/SENDER_NUMBER 재사용 + 신규):
//   SOLAPI_KAKAO_PFID — 카카오톡 채널 발신프로필 키 (예: KA01PF...)
// ============================================================

const BATCH_SIZE = 500;

export interface FriendTalkResult {
  to: string;
  success: boolean;
}

export interface FriendTalkBulkSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  results: FriendTalkResult[];
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, "");
  if (phone.startsWith("8210")) phone = "0" + phone.slice(2);
  else if (phone.startsWith("10")) phone = "0" + phone;
  return phone;
}

/** 여러 수신자에게 동일한 카카오톡 친구톡 메시지를 배치로 전송 */
export async function sendFriendTalkBulk(
  phones: string[],
  text: string
): Promise<FriendTalkBulkSummary> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const pfId = process.env.SOLAPI_KAKAO_PFID;

  if (!apiKey || !apiSecret || !senderNumber || !pfId) {
    throw new Error(
      "카카오 친구톡 자격증명이 설정되지 않았습니다. SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER, SOLAPI_KAKAO_PFID를 확인해주세요."
    );
  }

  const uniquePhones = Array.from(
    new Set(phones.map(normalizePhone).filter((p) => p.length >= 10))
  );
  if (uniquePhones.length === 0) {
    return { attempted: 0, succeeded: 0, failed: 0, results: [] };
  }

  const { SolapiMessageService } = await import("solapi");
  const messageService = new SolapiMessageService(apiKey, apiSecret);

  const results: FriendTalkResult[] = [];

  for (let i = 0; i < uniquePhones.length; i += BATCH_SIZE) {
    const batch = uniquePhones.slice(i, i + BATCH_SIZE);
    try {
      const response = await messageService.send(
        batch.map((to) => ({
          to,
          from: senderNumber,
          text,
          kakaoOptions: {
            pfId,
            disableSms: true,
          },
        }))
      );
      const failedNumbers = new Set((response.failedMessageList ?? []).map((f) => f.to));
      batch.forEach((to) => results.push({ to, success: !failedNumbers.has(to) }));
    } catch (err) {
      // MessageNotReceivedError 등 — 해당 배치 전원 실패로 기록하고 다음 배치 계속 진행
      console.error("[sendFriendTalkBulk] batch error:", err);
      batch.forEach((to) => results.push({ to, success: false }));
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return { attempted: results.length, succeeded, failed: results.length - succeeded, results };
}

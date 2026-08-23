// ============================================================
// Firebase Cloud Messaging — 안드로이드 앱 푸시 발송
// 서비스 계정 자격증명 필요 (Vercel 환경변수):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ============================================================

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel 환경변수에 줄바꿈이 리터럴 "\n"으로 들어오는 경우를 실제 개행으로 변환
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FCM 자격증명이 설정되지 않았습니다. Vercel 환경변수에 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY를 등록해주세요."
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export interface PushMessage {
  title: string;
  body: string;
  linkUrl?: string | null;
}

export interface PushSendResult {
  token: string;
  success: boolean;
  // 토큰 자체가 더 이상 유효하지 않아 DB에서 제거해야 하는 경우
  shouldRemove: boolean;
}

// FCM sendEachForMulticast 1회 호출당 최대 토큰 수
const BATCH_SIZE = 500;

/** 여러 기기 토큰에 동일한 푸시 메시지를 배치로 전송 */
export async function sendPushToTokens(
  tokens: string[],
  message: PushMessage
): Promise<PushSendResult[]> {
  if (tokens.length === 0) return [];

  const messaging = getMessaging(getFirebaseApp());
  const results: PushSendResult[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: message.title, body: message.body },
      data: message.linkUrl ? { link_url: message.linkUrl } : {},
      android: { priority: "high" },
    });

    response.responses.forEach((r, idx) => {
      const token = batch[idx];
      if (r.success) {
        results.push({ token, success: true, shouldRemove: false });
        return;
      }
      const code = r.error?.code ?? "";
      const shouldRemove =
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument";
      results.push({ token, success: false, shouldRemove });
    });
  }

  return results;
}

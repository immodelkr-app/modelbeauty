// ============================================================
// API 라우트: 관리자 전용 솔라피 환경변수 설정 여부 확인
// GET /api/admin/solapi-check
// ============================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";

export async function GET() {
  // 관리자 권한 확인 (로그인 필요)
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const solapiApiKey = process.env.SOLAPI_API_KEY;
  const solapiApiSecret = process.env.SOLAPI_API_SECRET;
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  const pfId = process.env.SOLAPI_KAKAO_PF_ID;
  const templateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID;

  return NextResponse.json({
    success: true,
    message: "솔라피 환경변수 설정 체크 (보안을 위해 값 자체는 숨겨집니다)",
    config: {
      SOLAPI_API_KEY: solapiApiKey ? `등록됨 (길이: ${solapiApiKey.length})` : "미등록 ❌",
      SOLAPI_API_SECRET: solapiApiSecret ? `등록됨 (길이: ${solapiApiSecret.length})` : "미등록 ❌",
      SOLAPI_SENDER_NUMBER: senderNumber ? `등록됨 (${senderNumber})` : "미등록 ❌",
      SOLAPI_KAKAO_PF_ID: pfId ? `등록됨 (${pfId})` : "미등록 ❌",
      SOLAPI_KAKAO_TEMPLATE_ID: templateId ? `등록됨 (${templateId})` : "미등록 ❌",
    }
  });
}

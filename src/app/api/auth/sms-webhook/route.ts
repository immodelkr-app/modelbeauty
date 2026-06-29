// ============================================================
// API 라우트: Supabase Send SMS Hook 수신 및 솔라피 발송
// POST /api/auth/sms-webhook
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";

const API_KEY = process.env.SOLAPI_API_KEY;
const API_SECRET = process.env.SOLAPI_API_SECRET;
const SENDER_NUMBER = process.env.SOLAPI_SENDER_NUMBER;

export async function POST(request: NextRequest) {
  try {
    // Supabase Auth Hooks가 보낸 요청 파라미터 파싱
    const body = await request.json();
    const { user, sms } = body;

    if (!user?.phone || !sms?.otp) {
      return NextResponse.json(
        { error: "잘못된 웹훅 페이로드 형식입니다." },
        { status: 400 }
      );
    }

    // ── 환경변수 체크 ──────────────────────────────────────────
    if (!API_KEY || !API_SECRET || !SENDER_NUMBER) {
      console.warn("[sms-webhook] 솔라피 환경변수가 비어있습니다. 테스트 모드로 처리합니다.");
      console.log(`[SMS 발송 시뮬레이션] 수신번호: ${user.phone}, 인증번호: ${sms.otp}`);
      return NextResponse.json({ success: true, message: "시뮬레이션 완료" });
    }

    // ── 솔라피 문자 발송 실행 ─────────────────────────────────
    const messageService = new SolapiMessageService(API_KEY, API_SECRET);
    
    // 국가번호 +82 형식을 국내 번호(010...)로 보정
    let toPhone = user.phone;
    if (toPhone.startsWith("+82")) {
      toPhone = "0" + toPhone.slice(3);
    }

    const response = await messageService.send({
      to: toPhone,
      from: SENDER_NUMBER,
      text: `[모델뷰티] 인증번호 [${sms.otp}]를 입력해주세요.`,
    });

    console.log("[sms-webhook] 솔라피 발송 완료:", response);

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error("[sms-webhook] 솔라피 발송 실패:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SMS 발송 실패" },
      { status: 500 }
    );
  }
}

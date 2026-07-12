// ============================================================
// API 라우트: 관리자 - 회원에게 쿠폰 수동 발급
// POST /api/admin/users/[id]/coupons
// body: { couponTemplateId: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";

const CORE_AUTH_URL = process.env.IM_CORE_AUTH_URL!;
const CORE_AUTH_SECRET = process.env.IM_CORE_AUTH_SECRET!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: masterUserId } = await params;
    const body = await request.json();
    const { couponTemplateId } = body;

    if (!couponTemplateId || typeof couponTemplateId !== "string") {
      return NextResponse.json(
        { success: false, error: "발급할 쿠폰 템플릿 ID를 입력해 주세요." },
        { status: 400 }
      );
    }

    // 아임모델 공화국 쿠폰 발급 API 호출
    const res = await fetch(`${CORE_AUTH_URL}/api/coupons/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": CORE_AUTH_SECRET,
      },
      body: JSON.stringify({
        masterUserId,
        couponTemplateId,
        issuedBy: "model_beauty_admin",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `쿠폰 발급 실패: ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      message: "쿠폰이 성공적으로 발급되었습니다.",
      coupon: data.coupon ?? null,
    });
  } catch (error) {
    console.error("[POST /api/admin/users/[id]/coupons] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "쿠폰 발급 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

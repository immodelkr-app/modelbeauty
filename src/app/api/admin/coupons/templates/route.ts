// ============================================================
// API 라우트: 관리자 - 발급 가능한 쿠폰 템플릿 목록 조회
// GET /api/admin/coupons/templates
// 아임모델 공화국 서버에서 쿠폰 템플릿 목록을 가져와 전달
// ============================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";

const CORE_AUTH_URL = process.env.IM_CORE_AUTH_URL!;
const CORE_AUTH_SECRET = process.env.IM_CORE_AUTH_SECRET!;

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const res = await fetch(`${CORE_AUTH_URL}/api/coupons/templates`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": CORE_AUTH_SECRET,
      },
      // 15초 캐시 (자주 바뀌지 않으므로 짧게 캐싱)
      next: { revalidate: 15 },
    });

    if (!res.ok) {
      // 아임모델 공화국에 쿠폰 템플릿 API 없을 경우 빈 배열 반환 (graceful fallback)
      console.warn("[GET /api/admin/coupons/templates] im-core-auth 쿠폰 템플릿 조회 실패:", res.status);
      return NextResponse.json({ success: true, templates: [] });
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      templates: data.templates ?? data.coupons ?? [],
    });
  } catch (error) {
    console.error("[GET /api/admin/coupons/templates] Error:", error);
    // 오류 시에도 빈 배열로 graceful fallback (어드민 화면 접근 차단 방지)
    return NextResponse.json({ success: true, templates: [] });
  }
}

// POST /api/admin/coupons/templates — 쿠폰 템플릿 신규 생성
export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { code, name, discountType, discountValue, validityDays } = body;

    if (!code || !name || !discountType || !discountValue || !validityDays) {
      return NextResponse.json(
        { success: false, error: "코드, 이름, 할인유형, 할인값, 유효기간은 필수입니다." },
        { status: 400 }
      );
    }

    const res = await fetch(`${CORE_AUTH_URL}/api/coupons/templates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": CORE_AUTH_SECRET,
      },
      body: JSON.stringify({ code, name, discountType, discountValue, validityDays }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: err.error || `템플릿 생성 실패: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, template: data.template ?? null });
  } catch (error) {
    console.error("[POST /api/admin/coupons/templates] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

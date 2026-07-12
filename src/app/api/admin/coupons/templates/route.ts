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

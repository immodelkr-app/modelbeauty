// ============================================================
// GET /api/admin/instagram/status — Admin Only
// 인스타그램 연동 상태 조회 (액세스 토큰 값 자체는 노출하지 않음)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { getStoredInstagramToken } from "@/lib/instagram";

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const stored = await getStoredInstagramToken();
    return Response.json({
      success: true,
      data: { connected: !!stored, expiresAt: stored?.expiresAt ?? null },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/instagram/status] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

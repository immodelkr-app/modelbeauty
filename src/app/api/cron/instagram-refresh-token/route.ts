// ============================================================
// GET  /api/cron/instagram-refresh-token — Vercel Cron 전용 (CRON_SECRET 인증)
// POST /api/cron/instagram-refresh-token — 관리자 수동 실행
// ============================================================
// 인스타그램 장기 액세스 토큰(60일 유효)을 매일 갱신합니다.
// 토큰은 발급/직전 갱신 후 24시간이 지나야 재갱신 가능하므로 일 1회면 충분합니다.

import { requireAdmin } from "@/lib/auth-admin";
import { getStoredInstagramToken, refreshLongLivedToken, saveInstagramToken } from "@/lib/instagram";

async function runRefreshJob() {
  const stored = await getStoredInstagramToken();
  if (!stored) {
    return { refreshed: false, message: "저장된 인스타그램 토큰이 없습니다. 먼저 /admin/settings에서 연동해 주세요." };
  }

  const { accessToken, expiresIn } = await refreshLongLivedToken(stored.accessToken);
  await saveInstagramToken(accessToken, expiresIn);
  return { refreshed: true };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRefreshJob();
    return Response.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[GET /api/cron/instagram-refresh-token] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const result = await runRefreshJob();
    return Response.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[POST /api/cron/instagram-refresh-token] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

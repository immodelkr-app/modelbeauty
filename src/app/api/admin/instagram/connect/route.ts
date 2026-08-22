// ============================================================
// GET /api/admin/instagram/connect — Admin Only
// 관리자를 인스타그램 OAuth 인증 화면으로 리다이렉트합니다.
// 인증 후 /api/instagram/callback 으로 돌아옵니다.
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { getInstagramOAuthUrl } from "@/lib/instagram";

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return Response.json(
      { success: false, error: "INSTAGRAM_APP_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${origin}/api/instagram/callback`;

  return Response.redirect(getInstagramOAuthUrl(appId, redirectUri));
}

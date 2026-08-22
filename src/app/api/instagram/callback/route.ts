// ============================================================
// GET /api/instagram/callback — 인스타그램 OAuth 콜백 (Admin Only)
// 인증 코드를 단기 토큰 → 장기(60일) 토큰으로 교환해 저장합니다.
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  saveInstagramToken,
} from "@/lib/instagram";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  const notAllowed = await requireAdmin();
  if (notAllowed) {
    return Response.redirect(`${origin}/admin/settings?instagram=unauthorized`);
  }

  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) {
    return Response.redirect(`${origin}/admin/settings?instagram=error`);
  }

  try {
    const redirectUri = `${origin}/api/instagram/callback`;
    const { accessToken: shortToken } = await exchangeCodeForShortLivedToken(code, redirectUri);
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(shortToken);
    await saveInstagramToken(accessToken, expiresIn);
    return Response.redirect(`${origin}/admin/settings?instagram=connected`);
  } catch (err) {
    console.error("[GET /api/instagram/callback] Error:", err);
    return Response.redirect(`${origin}/admin/settings?instagram=error`);
  }
}

// ============================================================
// 인스타그램(@im_modelbeauty) 자체 게시물 연동
// "Instagram API with Instagram Login" 사용 (2024년 이후 방식,
// 구 Instagram Basic Display API는 폐기됨)
// 액세스 토큰은 system_settings(key: instagram_token)에 저장하고
// /api/cron/instagram-refresh-token 크론으로 주기적으로 갱신합니다.
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase/server";

const SETTINGS_KEY = "instagram_token";
const GRAPH_BASE = "https://graph.instagram.com";

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | string;
  imageUrl: string;
  permalink: string;
  timestamp: string;
}

interface StoredToken {
  accessToken: string;
  expiresAt: string; // ISO
}

// ── OAuth 흐름 ───────────────────────────────────────────

export function getInstagramOAuthUrl(appId: string, redirectUri: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic");
  return url.toString();
}

export async function exchangeCodeForShortLivedToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`단기 토큰 교환 실패: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token };
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    throw new Error("INSTAGRAM_APP_SECRET 환경변수가 설정되지 않았습니다.");
  }

  const url = new URL(`${GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`장기 토큰 교환 실패: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`토큰 갱신 실패: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// ── 토큰 저장/조회 (system_settings 재사용) ──────────────

export async function saveInstagramToken(accessToken: string, expiresIn: number): Promise<void> {
  const admin = createSupabaseAdmin();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error } = await admin.from("system_settings").upsert({
    key: SETTINGS_KEY,
    value: { access_token: accessToken, expires_at: expiresAt },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getStoredInstagramToken(): Promise<StoredToken | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  const value = data?.value as { access_token?: string; expires_at?: string } | undefined;
  if (!value?.access_token) return null;
  return { accessToken: value.access_token, expiresAt: value.expires_at ?? "" };
}

// ── 게시물 조회 ──────────────────────────────────────────

interface MediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

export async function getModelBeautyInstagramPosts(limit = 8): Promise<InstagramPost[]> {
  const stored = await getStoredInstagramToken();
  if (!stored) return [];

  try {
    const url = new URL(`${GRAPH_BASE}/me/media`);
    url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", stored.accessToken);

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("[getModelBeautyInstagramPosts] Instagram API 오류:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = await res.json();

    const items: InstagramPost[] = (data.data ?? [])
      .map((item: MediaItem) => {
        const imageUrl = item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url;
        return {
          id: item.id,
          caption: item.caption ?? "",
          mediaType: item.media_type ?? "IMAGE",
          imageUrl: imageUrl ?? "",
          permalink: item.permalink ?? "",
          timestamp: item.timestamp ?? "",
        };
      })
      .filter((p: InstagramPost) => p.imageUrl && p.permalink);

    return items.slice(0, limit);
  } catch (err) {
    console.error("[getModelBeautyInstagramPosts]", err);
    return [];
  }
}

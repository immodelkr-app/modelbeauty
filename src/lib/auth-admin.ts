// ============================================================
// auth-admin.ts — 관리자 권한 검증 헬퍼
// Supabase Auth app_metadata의 role로 판별
// ============================================================
// 반드시 app_metadata를 사용해야 합니다 — user_metadata는 로그인한
// 본인이 클라이언트에서 직접 수정할 수 있고(supabase.auth.updateUser),
// 소셜 로그인 시에는 매 로그인마다 OAuth 프로바이더 프로필로 통째로
// 덮어써집니다. app_metadata는 서비스 롤(관리자 API)에서만 쓸 수 있어
// 유저 본인도, OAuth 로그인도 건드릴 수 없습니다.

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 현재 요청의 세션에서 관리자 여부를 확인합니다.
 * app_metadata에 { role: 'admin' }이 있어야 합니다.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const meta = user.app_metadata ?? {};
    return meta.role === "admin";
  } catch {
    return false;
  }
}

/**
 * 관리자가 아닌 경우 403 Response를 반환하는 헬퍼.
 * Route Handler에서 사용:
 *
 * ```ts
 * const notAllowed = await requireAdmin();
 * if (notAllowed) return notAllowed;
 * ```
 */
export async function requireAdmin(): Promise<Response | null> {
  const admin = await isAdmin();
  if (!admin) {
    return Response.json(
      { success: false, error: "관리자 권한이 필요합니다." },
      { status: 403 }
    );
  }
  return null;
}

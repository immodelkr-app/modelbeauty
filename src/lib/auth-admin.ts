// ============================================================
// auth-admin.ts — 관리자 권한 검증 헬퍼
// Supabase Auth user_metadata의 role 또는 is_admin으로 판별
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 현재 요청의 세션에서 관리자 여부를 확인합니다.
 * user_metadata에 { role: 'admin' } 또는 { is_admin: true }가 있어야 합니다.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const meta = user.user_metadata ?? {};
    return meta.role === "admin" || meta.is_admin === true;
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

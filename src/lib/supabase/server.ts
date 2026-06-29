import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 서버 컴포넌트 / Route Handler용 Supabase 클라이언트 (쿠키 기반 세션)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'model_beauty' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // 서버 컴포넌트에서 setAll은 무시 (Route Handler에서만 동작)
        }
      },
    },
  });
}

/**
 * 서버 전용 서비스 롤 클라이언트 (RLS 우회 — 관리자 작업에만 사용)
 */
export function createSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'model_beauty' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

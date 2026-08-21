import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const sanitizeEnv = (val: string | undefined) => {
  if (!val) return "";
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, "");
};

const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
 * 쿠키 없이 쓰는 공개 읽기 전용 클라이언트 (RLS 적용, anon key)
 * cookies()를 건드리지 않아 정적 렌더링(캐싱)이 가능한 페이지에서
 * 공개 데이터(카테고리 등)를 가져올 때 사용 — 매 요청 동적 렌더링을 강제하지 않음.
 */
export function createSupabasePublicClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'model_beauty' },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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

"use client";

import { createBrowserClient } from "@supabase/ssr";

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

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 (싱글톤)
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: 'model_beauty' },
  });
}

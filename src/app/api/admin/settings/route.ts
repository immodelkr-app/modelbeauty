// ============================================================
// GET   /api/admin/settings — 관리자 설정 조회 (Admin Only)
// PATCH /api/admin/settings — 관리자 설정 저장 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from("system_settings").select("key, value");
    if (error) throw error;

    const settings: Record<string, unknown> = {};
    for (const row of data ?? []) {
      settings[row.key] = row.value;
    }

    return Response.json({ success: true, data: settings });
  } catch (err: any) {
    console.error("[GET /api/admin/settings] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return Response.json({ success: false, error: "key가 필요합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("system_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/admin/settings] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

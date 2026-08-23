// ============================================================
// GET /api/admin/push/history — 푸시 발송 이력 조회 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 100);

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("push_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const items = (data ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      linkUrl: n.link_url,
      targetType: n.target_type,
      targetMasterUserId: n.target_master_user_id,
      targetCount: n.target_count,
      successCount: n.success_count,
      failureCount: n.failure_count,
      sentBy: n.sent_by,
      createdAt: n.created_at,
    }));

    return Response.json({ success: true, data: items });
  } catch (err) {
    console.error("[GET /api/admin/push/history] Error:", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/push/send — 앱 푸시 발송 (Admin Only)
// 1차 범위: 관리자가 직접 작성하는 수동 발송만 지원 (전체 / 특정 회원 테스트)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToTokens } from "@/lib/fcm";

export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { title, body: messageBody, linkUrl, targetType, targetMasterUserId } = body;

    if (!title || !messageBody) {
      return Response.json({ success: false, error: "제목과 내용은 필수입니다." }, { status: 400 });
    }
    if (targetType !== "all" && targetType !== "user") {
      return Response.json({ success: false, error: "targetType은 all 또는 user여야 합니다." }, { status: 400 });
    }
    if (targetType === "user" && !targetMasterUserId) {
      return Response.json({ success: false, error: "특정 회원 발송에는 targetMasterUserId가 필요합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    let tokenQuery = admin
      .from("push_tokens")
      .select("fcm_token")
      .eq("is_active", true);
    if (targetType === "user") {
      tokenQuery = tokenQuery.eq("master_user_id", targetMasterUserId);
    }
    const { data: tokenRows, error: tokenError } = await tokenQuery;
    if (tokenError) throw tokenError;

    const tokens = (tokenRows ?? []).map((r) => r.fcm_token);

    let successCount = 0;
    let failureCount = 0;
    const tokensToRemove: string[] = [];

    if (tokens.length > 0) {
      const results = await sendPushToTokens(tokens, {
        title,
        body: messageBody,
        linkUrl: linkUrl || null,
      });
      for (const r of results) {
        if (r.success) successCount++;
        else {
          failureCount++;
          if (r.shouldRemove) tokensToRemove.push(r.token);
        }
      }
      if (tokensToRemove.length > 0) {
        await admin.from("push_tokens").update({ is_active: false }).in("fcm_token", tokensToRemove);
      }
    }

    // 발송자 식별 (관리자 이메일)
    let sentBy: string | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      sentBy = user?.email ?? null;
    } catch {
      sentBy = null;
    }

    const { data: historyRow, error: historyError } = await admin
      .from("push_notifications")
      .insert({
        title,
        body: messageBody,
        link_url: linkUrl || null,
        target_type: targetType,
        target_master_user_id: targetType === "user" ? targetMasterUserId : null,
        target_count: tokens.length,
        success_count: successCount,
        failure_count: failureCount,
        sent_by: sentBy,
      })
      .select()
      .single();
    if (historyError) throw historyError;

    return Response.json({
      success: true,
      data: {
        id: historyRow.id,
        targetCount: tokens.length,
        successCount,
        failureCount,
      },
    });
  } catch (err) {
    console.error("[POST /api/admin/push/send] Error:", err);
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

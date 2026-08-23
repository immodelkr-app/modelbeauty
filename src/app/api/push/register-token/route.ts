// ============================================================
// POST /api/push/register-token — 기기 FCM 토큰 등록/갱신
// 비로그인 상태에서도 호출 가능(추후 전체 발송 대상이 됨).
// 로그인 세션이 있으면 master_user_id를 함께 저장해 특정 회원 타겟팅에 사용.
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, platform } = body;

    if (!token || typeof token !== "string") {
      return Response.json({ success: false, error: "token은 필수입니다." }, { status: 400 });
    }

    const masterUserId = await getAuthenticatedMasterUserId();
    const admin = createSupabaseAdmin();

    const { error } = await admin
      .from("push_tokens")
      .upsert(
        {
          fcm_token: token,
          master_user_id: masterUserId,
          platform: platform === "ios" ? "ios" : "android",
          is_active: true,
        },
        { onConflict: "fcm_token" }
      );

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("[POST /api/push/register-token] Error:", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

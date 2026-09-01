// ============================================================
// POST /api/trials/[id]/apply — 체험단 신청 (로그인 회원)
// body: { channelUrl: string, message?: string }
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }
    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;

    const { id: campaignId } = await params;
    const body = await request.json();
    const channelUrl = String(body.channelUrl ?? "").trim();
    const message = body.message ? String(body.message).trim() : null;

    if (!/^https?:\/\//.test(channelUrl)) {
      return Response.json({ success: false, error: "블로그/유튜브/인스타 링크는 http(s):// 로 시작해야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: campaign, error: campaignError } = await admin
      .from("trial_campaigns")
      .select("id, status, recruit_start, recruit_end")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return Response.json({ success: false, error: "체험단을 찾을 수 없습니다." }, { status: 404 });
    }
    if (campaign.status !== "recruiting") {
      return Response.json({ success: false, error: "지금은 모집 기간이 아닙니다." }, { status: 403 });
    }
    const now = Date.now();
    if (now < new Date(campaign.recruit_start).getTime() || now > new Date(campaign.recruit_end).getTime()) {
      return Response.json({ success: false, error: "모집 기간이 아닙니다." }, { status: 403 });
    }

    const { data: application, error: insertError } = await admin
      .from("trial_applications")
      .insert({
        campaign_id: campaignId,
        master_user_id: masterUserId,
        channel_url: channelUrl,
        message,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json({ success: false, error: "이미 이 체험단에 신청하셨습니다." }, { status: 409 });
      }
      throw insertError;
    }

    return Response.json({ success: true, data: application }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/trials/[id]/apply] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

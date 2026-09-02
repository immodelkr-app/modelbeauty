// ============================================================
// POST /api/trials/[id]/apply — 체험단 신청 (로그인 회원)
// body: { applicantName, applicantPhone, addressZipcode, addressMain, addressDetail?,
//         youtubeChannel?, instagramId?, channelUrl?, message? }
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
    const applicantName = String(body.applicantName ?? "").trim();
    const applicantPhone = String(body.applicantPhone ?? "").trim();
    const addressZipcode = String(body.addressZipcode ?? "").trim();
    const addressMain = String(body.addressMain ?? "").trim();
    const addressDetail = body.addressDetail ? String(body.addressDetail).trim() : null;
    const youtubeChannel = body.youtubeChannel ? String(body.youtubeChannel).trim() : null;
    const instagramId = body.instagramId ? String(body.instagramId).trim() : null;
    const channelUrl = body.channelUrl ? String(body.channelUrl).trim() : null;
    const message = body.message ? String(body.message).trim() : null;

    if (!applicantName || !applicantPhone || !addressZipcode || !addressMain) {
      return Response.json({ success: false, error: "이름, 연락처, 배송지 주소는 필수입니다." }, { status: 400 });
    }
    if (!youtubeChannel && !instagramId && !channelUrl) {
      return Response.json({ success: false, error: "유튜브 채널, 인스타그램 아이디, 기타 링크 중 최소 하나는 입력해주세요." }, { status: 400 });
    }
    if (channelUrl && !/^https?:\/\//.test(channelUrl)) {
      return Response.json({ success: false, error: "기타 링크는 http(s):// 로 시작해야 합니다." }, { status: 400 });
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
        applicant_name: applicantName,
        applicant_phone: applicantPhone,
        address_zipcode: addressZipcode,
        address_main: addressMain,
        address_detail: addressDetail,
        youtube_channel: youtubeChannel,
        instagram_id: instagramId,
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

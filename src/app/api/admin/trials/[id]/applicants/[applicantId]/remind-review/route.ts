// ============================================================
// POST /api/admin/trials/[id]/applicants/[applicantId]/remind-review
// 선정됐지만 아직 체험 후기를 안 올린 신청자에게 앱푸시 + 문자로
// 후기 작성 리마인드를 보낸다. (관리자가 신청자 목록에서 수동 발송)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToTokens } from "@/lib/fcm";
import { getMasterUser } from "@/lib/core-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; applicantId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: campaignId, applicantId } = await params;
    const admin = createSupabaseAdmin();

    const { data: application, error: appError } = await admin
      .from("trial_applications")
      .select("id, master_user_id, campaign_id, status")
      .eq("id", applicantId)
      .eq("campaign_id", campaignId)
      .single();
    if (appError || !application) {
      return NextResponse.json({ success: false, error: "신청 내역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (application.status !== "selected") {
      return NextResponse.json({ success: false, error: "선정된 신청자에게만 리마인드를 보낼 수 있습니다." }, { status: 400 });
    }

    const { data: existingReview } = await admin
      .from("trial_reviews")
      .select("id")
      .eq("trial_application_id", applicantId)
      .maybeSingle();
    if (existingReview) {
      return NextResponse.json({ success: false, error: "이미 체험 후기를 작성한 신청자입니다." }, { status: 400 });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("trial_campaigns")
      .select("title")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) {
      return NextResponse.json({ success: false, error: "체험단을 찾을 수 없습니다." }, { status: 404 });
    }

    const title = "📝 체험 후기 작성 안내";
    const bodyText = `[${campaign.title}] 체험은 잘 하고 계신가요? 다른 분들에게 도움이 되도록 체험 후기를 남겨주세요!`;
    const linkUrl = `/trials/${campaignId}`;

    let pushResult: "sent" | "no_token" | "failed" | "skipped" = "skipped";
    let smsResult: "sent" | "no_phone" | "failed" | "skipped" = "skipped";

    // 앱 푸시
    try {
      const { data: tokenRows } = await admin
        .from("push_tokens")
        .select("fcm_token")
        .eq("master_user_id", application.master_user_id)
        .eq("is_active", true);
      const tokens = (tokenRows ?? []).map((r) => r.fcm_token);
      if (tokens.length > 0) {
        const results = await sendPushToTokens(tokens, { title, body: bodyText, linkUrl });
        pushResult = results.some((r) => r.success) ? "sent" : "failed";
      } else {
        pushResult = "no_token";
      }
    } catch (err) {
      console.error("[POST .../remind-review] push error:", err);
      pushResult = "failed";
    }

    // 문자(SMS)
    try {
      const solapiApiKey = process.env.SOLAPI_API_KEY;
      const solapiApiSecret = process.env.SOLAPI_API_SECRET;
      const senderNumber = process.env.SOLAPI_SENDER_NUMBER;

      if (solapiApiKey && solapiApiSecret && senderNumber) {
        const masterUser = await getMasterUser(application.master_user_id);
        if (masterUser?.phoneNumber) {
          let toPhone = masterUser.phoneNumber.replace(/\D/g, "");
          if (toPhone.startsWith("8210")) toPhone = "0" + toPhone.slice(2);
          else if (toPhone.startsWith("10")) toPhone = "0" + toPhone;

          const { SolapiMessageService } = await import("solapi");
          const messageService = new SolapiMessageService(solapiApiKey, solapiApiSecret);
          await messageService.send({
            to: toPhone,
            from: senderNumber,
            text: `[모델뷰티] ${bodyText}`,
          });
          smsResult = "sent";
        } else {
          smsResult = "no_phone";
        }
      }
    } catch (err) {
      console.error("[POST .../remind-review] sms error:", err);
      smsResult = "failed";
    }

    const { data: updated, error: updateError } = await admin
      .from("trial_applications")
      .update({ review_reminded_at: new Date().toISOString() })
      .eq("id", applicantId)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updated, pushResult, smsResult });
  } catch (err) {
    console.error("[POST /api/admin/trials/[id]/applicants/[applicantId]/remind-review]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

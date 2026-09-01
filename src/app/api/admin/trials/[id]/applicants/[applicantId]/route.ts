// ============================================================
// PATCH /api/admin/trials/[id]/applicants/[applicantId] — 신청자 선정/반려 처리
// body: { status: "selected" | "rejected" }
// "selected" 처리 시 앱푸시 + 문자를 자동 발송한다.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToTokens } from "@/lib/fcm";
import { getMasterUser } from "@/lib/core-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; applicantId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: campaignId, applicantId } = await params;
    const body = await request.json();
    const status = body.status;

    if (!["selected", "rejected"].includes(status)) {
      return NextResponse.json({ success: false, error: "status는 selected 또는 rejected여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: application, error: appError } = await admin
      .from("trial_applications")
      .select("id, master_user_id, campaign_id")
      .eq("id", applicantId)
      .eq("campaign_id", campaignId)
      .single();
    if (appError || !application) {
      return NextResponse.json({ success: false, error: "신청 내역을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: campaign, error: campaignError } = await admin
      .from("trial_campaigns")
      .select("title, campaign_type")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) {
      return NextResponse.json({ success: false, error: "체험단을 찾을 수 없습니다." }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = { status };
    let pushResult: "sent" | "no_token" | "failed" | "skipped" = "skipped";
    let smsResult: "sent" | "no_phone" | "failed" | "skipped" = "skipped";

    if (status === "selected") {
      const title = "🎉 체험단 선정 안내";
      const bodyText =
        campaign.campaign_type === "paid"
          ? `[${campaign.title}] 체험단에 선정되셨습니다! 참가비 결제 안내를 순차적으로 드릴게요.`
          : `[${campaign.title}] 체험단에 선정되셨습니다! 곧 제품을 보내드릴게요.`;
      const linkUrl = `/trials/${campaignId}`;

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
        console.error("[PATCH .../applicants/[applicantId]] push error:", err);
        pushResult = "failed";
      }

      // 문자(SMS) — 국내 주 채널
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
        console.error("[PATCH .../applicants/[applicantId]] sms error:", err);
        smsResult = "failed";
      }

      updatePayload.notified_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await admin
      .from("trial_applications")
      .update(updatePayload)
      .eq("id", applicantId)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, data: updated, pushResult, smsResult });
  } catch (err) {
    console.error("[PATCH /api/admin/trials/[id]/applicants/[applicantId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/trials/[id]/notify
// 체험단 모집 안내를 전체 회원에게 카카오 친구톡("아임모델" 채널) + 앱푸시로 발송한다.
// 관리자가 버튼을 눌러 수동으로만 발송한다 (자동 발송 아님).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";
import { sendBroadcastNotify } from "@/lib/notify-broadcast";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: campaignId } = await params;
    const admin = createSupabaseAdmin();

    const { data: campaign, error: campaignError } = await admin
      .from("trial_campaigns")
      .select("title, description")
      .eq("id", campaignId)
      .single();
    if (campaignError || !campaign) {
      return NextResponse.json({ success: false, error: "체험단을 찾을 수 없습니다." }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const linkUrl = `${origin}/trials/${campaignId}`;
    const friendTalkText = [
      `🎁 [모델뷰티] 신규 체험단 모집`,
      campaign.title,
      campaign.description?.trim() || null,
      "",
      `지금 확인하기: ${linkUrl}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    let sentBy: string | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      sentBy = user?.email ?? null;
    } catch {
      sentBy = null;
    }

    const result = await sendBroadcastNotify({
      pushTitle: "🎁 신규 체험단 모집",
      pushBody: campaign.title,
      pushLinkUrl: `/trials/${campaignId}`,
      friendTalkText,
      sentBy,
    });

    await admin
      .from("trial_campaigns")
      .update({ friendtalk_sent_at: new Date().toISOString() })
      .eq("id", campaignId);

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/admin/trials/[id]/notify]", err);
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

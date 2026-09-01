// ============================================================
// POST /api/admin/trials/[id]/notify-friendtalk
// 체험단 모집 안내를 "아임모델" 카카오톡 채널 친구 전체에게 친구톡으로 발송한다.
// 관리자가 버튼을 눌러 수동으로만 발송한다 (자동 발송 아님).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { listMasterMembers } from "@/lib/core-auth";
import { sendFriendTalkBulk } from "@/lib/kakao-friendtalk";

export const maxDuration = 60;

async function fetchAllPhones(): Promise<string[]> {
  const PAGE_SIZE = 500;
  let offset = 0;
  let total = Infinity;
  const phones: string[] = [];

  while (phones.length < total) {
    const { members, total: t } = await listMasterMembers({ limit: PAGE_SIZE, offset });
    total = t;
    if (members.length === 0) break;
    for (const m of members) {
      if (m.phoneNumber) phones.push(m.phoneNumber);
    }
    offset += members.length;
    if (members.length < PAGE_SIZE) break;
  }

  return phones;
}

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
    const link = `${origin}/trials/${campaignId}`;
    const text = [
      `🎁 [모델뷰티] 신규 체험단 모집`,
      campaign.title,
      campaign.description?.trim() || null,
      "",
      `지금 확인하기: ${link}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const phones = await fetchAllPhones();
    const summary = await sendFriendTalkBulk(phones, text);

    await admin
      .from("trial_campaigns")
      .update({ friendtalk_sent_at: new Date().toISOString() })
      .eq("id", campaignId);

    return NextResponse.json({
      success: true,
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
    });
  } catch (err) {
    console.error("[POST /api/admin/trials/[id]/notify-friendtalk]", err);
    const message = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================
// 관리자 수동 전체 발송 — 카카오 친구톡 + 앱푸시를 한 번에 발송한다.
// 체험단 모집 안내, 라이브 방송 시작 안내 등에서 공용으로 사용.
// 두 채널은 대상 명단이 서로 다르므로(친구톡: im-core-auth 전화번호,
// 앱푸시: push_tokens 테이블) 독립적으로 발송하고 각각 성공/실패를 리턴한다.
// ============================================================

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { listMasterMembers } from "@/lib/core-auth";
import { sendFriendTalkBulk } from "@/lib/kakao-friendtalk";
import { sendPushToTokens } from "@/lib/fcm";

export interface BroadcastNotifyResult {
  friendtalk: { attempted: number; succeeded: number; failed: number; error?: string };
  push: { targetCount: number; successCount: number; failureCount: number; error?: string };
}

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

export async function sendBroadcastNotify(params: {
  pushTitle: string;
  pushBody: string;
  pushLinkUrl: string | null;
  friendTalkText: string;
  sentBy: string | null;
}): Promise<BroadcastNotifyResult> {
  const admin = createSupabaseAdmin();

  const friendtalkPromise = (async (): Promise<BroadcastNotifyResult["friendtalk"]> => {
    try {
      const phones = await fetchAllPhones();
      const summary = await sendFriendTalkBulk(phones, params.friendTalkText);
      return { attempted: summary.attempted, succeeded: summary.succeeded, failed: summary.failed };
    } catch (err) {
      console.error("[sendBroadcastNotify] friendtalk error:", err);
      return { attempted: 0, succeeded: 0, failed: 0, error: err instanceof Error ? err.message : "친구톡 발송 실패" };
    }
  })();

  const pushPromise = (async (): Promise<BroadcastNotifyResult["push"]> => {
    try {
      const { data: tokenRows, error: tokenError } = await admin
        .from("push_tokens")
        .select("fcm_token")
        .eq("is_active", true);
      if (tokenError) throw tokenError;

      const tokens = (tokenRows ?? []).map((r) => r.fcm_token);
      let successCount = 0;
      let failureCount = 0;
      const tokensToRemove: string[] = [];

      if (tokens.length > 0) {
        const results = await sendPushToTokens(tokens, {
          title: params.pushTitle,
          body: params.pushBody,
          linkUrl: params.pushLinkUrl,
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

      await admin.from("push_notifications").insert({
        title: params.pushTitle,
        body: params.pushBody,
        link_url: params.pushLinkUrl,
        target_type: "all",
        target_count: tokens.length,
        success_count: successCount,
        failure_count: failureCount,
        sent_by: params.sentBy,
      });

      return { targetCount: tokens.length, successCount, failureCount };
    } catch (err) {
      console.error("[sendBroadcastNotify] push error:", err);
      return { targetCount: 0, successCount: 0, failureCount: 0, error: err instanceof Error ? err.message : "앱푸시 발송 실패" };
    }
  })();

  const [friendtalk, push] = await Promise.all([friendtalkPromise, pushPromise]);
  return { friendtalk, push };
}

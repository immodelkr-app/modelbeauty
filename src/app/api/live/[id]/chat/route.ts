// ============================================================
// GET  /api/live/[id]/chat — 라이브 채팅 이력 조회 (최신 50개)
// POST /api/live/[id]/chat — 라이브 채팅 메시지 등록 (Persist)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { syncMasterUser, issueCoupon } from "@/lib/core-auth";
import { isAdmin } from "@/lib/auth-admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: chats, error } = await supabase
      .from("live_stream_chats")
      .select("*")
      .eq("stream_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // 클라이언트 표시는 최신 메시지가 하단에 오도록 시간순으로 변환
    const formattedChats = (chats ?? [])
      .map((chat) => ({
        id: chat.id,
        streamId: chat.stream_id,
        masterUserId: chat.master_user_id,
        nickname: chat.nickname,
        message: chat.message,
        createdAt: chat.created_at,
      }))
      .reverse();

    return Response.json({ success: true, data: formattedChats });
  } catch (err: any) {
    console.error("[GET /api/live/[id]/chat] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return Response.json({ success: false, error: "메시지 내용을 입력해주세요." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    // ── 유저 정보 동기화 및 관리자 판별 ──────────────────────────
    // user_metadata에 캐시된 master_user_id를 우선 사용 (im-core-auth sync 불필요)
    let masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    let nickname = user.user_metadata?.name ?? "사용자";
    let isCrew = false;
    let crewNickname = "";

    const admin = await isAdmin();

    if (!admin && user.phone) {
      try {
        const cleanUserPhone = user.phone.replace(/[^0-9]/g, ""); // e.g. "821012345678" or "01012345678"
        const formattedUserPhone = cleanUserPhone.startsWith("8210") 
          ? "010" + cleanUserPhone.substring(4) 
          : cleanUserPhone; // e.g. "01012345678"

        const { data: allCrews } = await supabase
          .from("live_crews")
          .select("nickname, phone");

        const matchedCrew = (allCrews ?? []).find(c => {
          const cleanCrewPhone = c.phone.replace(/[^0-9]/g, "");
          return cleanCrewPhone === formattedUserPhone || cleanCrewPhone === cleanUserPhone;
        });

        if (matchedCrew) {
          isCrew = true;
          crewNickname = matchedCrew.nickname;
        }
      } catch (crewCheckError) {
        console.warn("[POST /api/live/[id]/chat] live_crews check failed:", crewCheckError);
      }
    }

    if (admin) {
      nickname = "모델뷰티";
    } else if (isCrew) {
      nickname = `🎤 ${crewNickname}`;
    } else if (user.phone) {
      // user_metadata에 캐시가 없는 경우만 im-core-auth sync 호출
      if (!user.user_metadata?.master_user_id) {
        try {
          const masterUser = await syncMasterUser({
            phoneNumber: user.phone,
            appName: "MODEL_BEAUTY",
            localUserId: user.id,
            name: user.user_metadata?.name,
          });
          masterUserId = masterUser.masterUserId;
          nickname = masterUser.name ?? nickname;
        } catch (coreAuthError) {
          console.warn("[POST /api/live/[id]/chat] im-core-auth sync failed, using fallback:", coreAuthError);
        }
      } else {
        nickname = user.user_metadata?.name ?? nickname;
      }
    } else if (user.email) {
      nickname = user.user_metadata?.name ?? user.email.split("@")[0] ?? "관리자";
    }

    // ── 채팅 DB 저장 ─────────────────────────────────────────
    const { data: newChat, error: insertError } = await supabase
      .from("live_stream_chats")
      .insert({
        stream_id: id,
        master_user_id: masterUserId,
        nickname,
        message: message.trim(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // ── 선착순 댓글(키워드) 이벤트 매칭 확인 ───────────────────
    // 방송에서 구두로 안내한 키워드와 채팅 내용이 일치하면 참여 처리.
    // 실패해도 채팅 자체는 이미 저장됐으므로 이벤트 처리 오류가 채팅 전송을 막지 않는다.
    let keywordEventResult: {
      isWinner: boolean;
      matched: boolean;
      prizeLabel?: string;
      winnerRank?: number;
      winnerCount?: number;
      couponIssueStatus?: "issued" | "failed" | "not_applicable";
    } | null = null;

    try {
      const admin = createSupabaseAdmin();
      const { data: activeEvent } = await admin
        .from("live_keyword_events")
        .select("id, keyword, coupon_template_id, prize_label")
        .eq("stream_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeEvent && message.trim().toLowerCase() === activeEvent.keyword.trim().toLowerCase()) {
        const { error: entryInsertError } = await admin.from("live_keyword_entries").insert({
          event_id: activeEvent.id,
          master_user_id: masterUserId,
          nickname,
        });

        // UNIQUE(event_id, master_user_id) 위반 = 이미 참여함 → 조용히 무시 (일반 채팅으로만 처리)
        if (!entryInsertError) {
          const { data: claimRows } = await admin.rpc("claim_live_keyword_winner_slot", {
            p_event_id: activeEvent.id,
          });
          const claim = claimRows?.[0] as
            | { claimed: boolean; winner_rank: number | null; winner_count: number | null; coupon_template_id: string | null; prize_label: string | null }
            | undefined;

          if (claim?.claimed) {
            await admin
              .from("live_keyword_entries")
              .update({ is_winner: true })
              .eq("event_id", activeEvent.id)
              .eq("master_user_id", masterUserId);

            let couponIssueStatus: "issued" | "failed" | "not_applicable" = "not_applicable";
            if (claim.coupon_template_id) {
              try {
                await issueCoupon({
                  masterUserId,
                  couponTemplateId: claim.coupon_template_id,
                  issuedBy: "model_beauty_live_keyword_event",
                });
                couponIssueStatus = "issued";
              } catch (couponError) {
                console.error("[POST /api/live/[id]/chat] 키워드 이벤트 쿠폰 자동 발급 실패:", couponError);
                couponIssueStatus = "failed";
              }
              await admin
                .from("live_keyword_entries")
                .update({ coupon_issue_status: couponIssueStatus })
                .eq("event_id", activeEvent.id)
                .eq("master_user_id", masterUserId);
            }

            keywordEventResult = {
              isWinner: true,
              matched: true,
              prizeLabel: claim.prize_label ?? undefined,
              winnerRank: claim.winner_rank ?? undefined,
              winnerCount: claim.winner_count ?? undefined,
              couponIssueStatus,
            };
          } else {
            keywordEventResult = { isWinner: false, matched: true };
          }
        }
      }
    } catch (keywordError) {
      console.error("[POST /api/live/[id]/chat] 키워드 이벤트 처리 실패:", keywordError);
    }

    return Response.json({
      success: true,
      data: {
        id: newChat.id,
        streamId: newChat.stream_id,
        masterUserId: newChat.master_user_id,
        nickname: newChat.nickname,
        message: newChat.message,
        createdAt: newChat.created_at,
      },
      keywordEvent: keywordEventResult,
    });
  } catch (err: any) {
    console.error("[POST /api/live/[id]/chat] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// API 라우트: 현재 유저 정보 조회
// GET /api/auth/me
// ============================================================
// Supabase 세션에서 유저 확인 후 im-core-auth 마스터유저 정보 반환
// 전화번호 유저: im-core-auth sync → 통합 포인트/닉네임 반환
// 이메일 유저(관리자 등): Supabase user_metadata에서 name 반환

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { syncMasterUser } from "@/lib/core-auth";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다." }, { status: 401 });
    }

    // ── 이메일 유저 (관리자 등) ──────────────────────────────────
    // 전화번호 없이 이메일만 있는 경우 — im-core-auth sync 없이 로컬 정보 반환
    if (!user.phone && user.email) {
      return NextResponse.json({
        success: true,
        user: {
          masterUserId: user.id,
          phoneNumber: null,
          name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "관리자",
          integratedPoints: 0,
          linkedApps: ["MODEL_BEAUTY"],
          isEmailUser: true,
        },
      });
    }

    // ── 전화번호 유저 — im-core-auth 동기화 ─────────────────────
    if (!user.phone) {
      return NextResponse.json({ error: "전화번호 인증이 필요합니다." }, { status: 401 });
    }

    try {
      // im-core-auth에서 마스터유저 동기화 (없으면 생성)
      const masterUser = await syncMasterUser({
        phoneNumber: user.phone,
        appName: "MODEL_BEAUTY",
        localUserId: user.id,
        name: user.user_metadata?.name,
      });

      // master_user_id를 Supabase user_metadata에 캐싱
      if (masterUser.masterUserId && user.user_metadata?.master_user_id !== masterUser.masterUserId) {
        try {
          const adminClient = createSupabaseAdmin();
          await adminClient.auth.admin.updateUserById(user.id, {
            user_metadata: {
              master_user_id: masterUser.masterUserId,
              name: masterUser.name ?? user.user_metadata?.name,
            },
          });
        } catch (metaErr) {
          console.warn("[/api/auth/me] user_metadata 캐싱 실패:", metaErr);
        }
      }

      return NextResponse.json({ success: true, user: masterUser });
    } catch (coreAuthError) {
      // im-core-auth 서버가 아직 미배포인 경우 graceful fallback
      console.warn("[/api/auth/me] im-core-auth 연결 불가, 로컬 세션으로 fallback:", coreAuthError);
      return NextResponse.json({
        success: true,
        user: {
          masterUserId: user.id,
          phoneNumber: user.phone,
          name: user.user_metadata?.name ?? null,
          integratedPoints: 0,
          linkedApps: ["MODEL_BEAUTY"],
          _offline: true,
        },
      });
    }
  } catch (error) {
    console.error("[/api/auth/me]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

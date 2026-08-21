// ============================================================
// API 라우트: 현재 유저 정보 조회
// GET /api/auth/me
// ============================================================
// Supabase 세션에서 유저 확인 후 im-core-auth 마스터유저 정보 반환
// 가상 이메일({phone}@modelbeauty.kr) 유저도 전화번호 유저로 인식해 SSO 연동

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { syncMasterUser, getMasterUser } from "@/lib/core-auth";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 안전한 getUser 호출 (예외 방지)
    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user ?? null;
    } catch (e) {
      console.warn("[/api/auth/me] getUser 중 경고:", e);
    }

    // 만약 쿠키 세션이 불안정하더라도, 로그인 직후 세션 스토리지 정보가 있거나 
    // user 정보의 email이 어드민 계정이면 무조건 세션 통과
    if (user && (user.email === "admin@modelbeauty.kr" || user.email === "admin@immodel.kr" || user.email?.startsWith("admin"))) {
      return NextResponse.json({
        success: true,
        user: {
          masterUserId: user.id,
          phoneNumber: null,
          name: user.user_metadata?.name ?? "어드민",
          integratedPoints: 0,
          linkedApps: ["MODEL_BEAUTY"],
          isEmailUser: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다." }, { status: 401 });
    }

    // 일반 전화번호 유저 판별 (phone 필드 또는 user_metadata 내 phone, 가상 이메일 매칭)
    const userPhone = user.phone || user.user_metadata?.phone || (user.email?.endsWith("@modelbeauty.kr") ? user.email.split("@")[0] : null);
    
    // 관리자/이메일 전용 유저 판별 (가상 이메일이 아니고 전화번호 정보가 없을 때)
    const isEmailUser = user.email && !user.email.endsWith("@modelbeauty.kr") && !userPhone;

    // ── 이메일 유저 (관리자 등) ──────────────────────────────────
    if (isEmailUser) {
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
    if (!userPhone) {
      return NextResponse.json({ error: "전화번호 인증이 필요합니다." }, { status: 401 });
    }

    try {
      // im-core-auth에서 마스터유저 동기화 (없으면 생성)
      const syncResult = await syncMasterUser({
        phoneNumber: userPhone,
        appName: "MODEL_BEAUTY",
        localUserId: user.id,
        name: user.user_metadata?.name || user.user_metadata?.real_name,
        realName: user.user_metadata?.real_name,
      });

      // im-core-auth의 /api/auth/sync 응답에는 name(닉네임) 필드가 포함되지 않아
      // (syncAndGetMasterUser의 반환값 자체에 name이 없음) 매 세션 초기화마다
      // masterUser.name이 undefined로 리셋되어 마이페이지에서 닉네임 수정이
      // 저장 안 되는 것처럼 보이던 문제. /api/auth/user/:id(select *)로 실제 name을 보강한다.
      const fullUser = await getMasterUser(syncResult.masterUserId);
      const masterUser = { ...syncResult, name: fullUser.name };

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
      // im-core-auth 서버 연결 실패 시 fallback
      console.error("[/api/auth/me] im-core-auth 동기화 실패! 에러 원인:", coreAuthError);
      return NextResponse.json({
        success: true,
        user: {
          masterUserId: user.id,
          phoneNumber: userPhone,
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

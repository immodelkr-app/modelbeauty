// ============================================================
// API 라우트: 신규 회원가입
// POST /api/auth/signup
// ============================================================
// 닉네임/비밀번호 기반 회원가입:
// 1. im-core-auth 닉네임 중복 확인
// 2. Supabase Auth에 가상 이메일(`{phone}@modelbeauty.kr`)로 signUp
// 3. im-core-auth sync로 마스터 계정 생성/연결
// 4. 기존 타 앱 계정이 있으면 통합 안내

import { NextRequest, NextResponse } from "next/server";
import { checkNicknameAvailable, syncMasterUser } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, realName, password, phoneNumber } = body as {
      nickname?: string;
      realName?: string;
      password?: string;
      phoneNumber?: string;
    };

    // ── 유효성 검사 ──────────────────────────────────────────
    if (!nickname?.trim()) {
      return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
    }
    if (!realName?.trim()) {
      return NextResponse.json({ error: "실명을 입력해주세요." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자리 이상이어야 합니다." }, { status: 400 });
    }
    if (!phoneNumber?.trim()) {
      return NextResponse.json({ error: "휴대폰 번호를 입력해주세요." }, { status: 400 });
    }

    const cleanNickname = nickname.trim();
    const cleanRealName = realName.trim();
    const phoneDigits = phoneNumber.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return NextResponse.json({ error: "올바른 휴대폰 번호를 입력해주세요." }, { status: 400 });
    }

    // ── 닉네임 중복 확인 (im-core-auth 통합 체크) ────────────
    const isAvailable = await checkNicknameAvailable(cleanNickname);
    if (!isAvailable) {
      return NextResponse.json(
        { error: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요." },
        { status: 409 }
      );
    }

    // ── Supabase Auth 가입 ────────────────────────────────────
    const authEmail = `${phoneDigits}@modelbeauty.kr`;
    const adminClient = createSupabaseAdmin();

    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true, // 이메일 인증 없이 즉시 활성화
      user_metadata: {
        name: cleanNickname,
        real_name: cleanRealName,
        phone: phoneDigits,
      },
    });

    if (signUpError || !authData.user) {
      // 이미 가입된 경우 (같은 전화번호)
      if (signUpError?.message?.includes("already registered") || signUpError?.code === "email_exists") {
        return NextResponse.json(
          { error: "이미 가입된 휴대폰 번호입니다. 닉네임 찾기 또는 비밀번호 찾기를 이용해주세요." },
          { status: 409 }
        );
      }
      console.error("[POST /api/auth/signup] Supabase 가입 실패:", signUpError);
      return NextResponse.json(
        { error: signUpError?.message || "회원가입에 실패했습니다." },
        { status: 500 }
      );
    }

    const localUserId = authData.user.id;

    // ── im-core-auth SSO 동기화 ───────────────────────────────
    let masterUser = null;
    let linkedApps: string[] = [];
    try {
      masterUser = await syncMasterUser({
        phoneNumber: phoneDigits,
        appName: "MODEL_BEAUTY",
        localUserId,
        name: cleanNickname,
        realName: cleanRealName,
      });
      linkedApps = (masterUser as any).linkedApps ?? [];

      // masterUserId를 Supabase user_metadata에 캐싱
      if ((masterUser as any).masterUserId) {
        await adminClient.auth.admin.updateUserById(localUserId, {
          user_metadata: {
            master_user_id: (masterUser as any).masterUserId,
            name: cleanNickname,
            real_name: cleanRealName,
            phone: phoneDigits,
          },
        });
      }
    } catch (syncErr) {
      // im-core-auth 동기화 실패해도 로컬 가입은 완료 처리
      console.warn("[POST /api/auth/signup] im-core-auth 동기화 실패 (비중단):", syncErr);
    }

    return NextResponse.json(
      {
        success: true,
        linkedApps, // 기존 타 앱 계정 통합 안내용
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/auth/signup]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

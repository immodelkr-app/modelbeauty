// ============================================================
// API 라우트: 닉네임으로 Supabase 가상 이메일 조회
// POST /api/auth/get-auth-email
// ============================================================
// 로그인 시 닉네임을 받아서 im-core-auth에서 휴대폰번호를 조회한 뒤
// Supabase Auth에 사용된 가상 이메일 형식으로 반환

import { NextRequest, NextResponse } from "next/server";
import { getMasterUserByNickname } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname } = body as { nickname?: string };

    if (!nickname?.trim()) {
      return NextResponse.json(
        { found: false, error: "nickname은 필수입니다." },
        { status: 400 }
      );
    }

    // ── 어드민 닉네임 하드코딩 예외 처리 ───────────────────────
    const cleanNickname = nickname.trim();
    if (cleanNickname === "어드민" || cleanNickname === "최고관리자") {
      return NextResponse.json({ found: true, authEmail: "admin@immodel.kr" }, { status: 200 });
    }

    // 1. im-core-auth에서 닉네임 → 마스터유저(휴대폰번호) 조회 시도
    let phoneDigits: string | null = null;
    try {
      const masterUser = await getMasterUserByNickname(cleanNickname);
      if (masterUser?.phoneNumber) {
        phoneDigits = masterUser.phoneNumber.replace(/\D/g, "");
      }
    } catch (e) {
      console.warn("[get-auth-email] getMasterUserByNickname 예외:", e);
    }

    // 2. 로컬 Supabase Auth 유저 단건 조회(DB 함수) 및 email 보정
    // (타 앱 → 모델뷰티 SSO 연동 시 로컬 계정 email이 비어있거나 형식이 다를 수 있어
    //  보정이 필요함. 예전에는 listUsers로 전체를 끌어와 매 로그인마다 훑었으나
    //  find_local_auth_user 함수로 대체해 단건 조회로 처리한다)
    const adminClient = createSupabaseAdmin();
    const { data: matchedUsers, error: findUserError } = await adminClient.rpc(
      "find_local_auth_user",
      { p_phone: phoneDigits, p_nickname: cleanNickname }
    );
    if (findUserError) {
      console.warn("[get-auth-email] find_local_auth_user 예외:", findUserError);
    }
    const localUser = (matchedUsers?.[0] as
      | { id: string; email: string | null; phone: string | null; user_metadata: Record<string, any> | null }
      | undefined) ?? null;

    if (localUser) {
      // 가상 이메일 계산은 email이 비어있을 때 자동 보정용으로만 쓴다.
      // localUser.phone(Supabase 국제형식, 예: 821038601416)을 우선 쓰면 국가코드 자리수 때문에
      // 뒤 11자리를 잘못 잘라내 실제 email과 다른 값이 나오는 버그가 있었으므로
      // user_metadata.phone(국내형식) > im-core-auth 조회값 순으로 우선한다.
      const rawPhone = (localUser.user_metadata?.phone || phoneDigits || localUser.phone || "").replace(/\D/g, "");
      const cleanPhone = rawPhone.startsWith("82") && rawPhone.length === 12
        ? `0${rawPhone.slice(2)}`
        : rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
      const expectedEmail = cleanPhone ? `${cleanPhone}@modelbeauty.kr` : null;

      // 만약 기존 전화번호 OTP 가입자 등 Supabase Auth의 email이 비어있다면 자동 업데이트
      if ((!localUser.email || localUser.email === "") && expectedEmail) {
        console.log(`[get-auth-email] Supabase 유저 email 비어있음 -> ${expectedEmail}로 자동 보정`);
        try {
          await adminClient.auth.admin.updateUserById(localUser.id, {
            email: expectedEmail,
            email_confirm: true,
          });
        } catch (updateErr) {
          console.warn("[get-auth-email] updateUserById 보정 실패:", updateErr);
        }
      }

      // 이미 등록된 email이 있으면 그대로 사용 (재계산한 값으로 덮어쓰지 않음 —
      // 실제 로그인 계정 이메일과 어긋나면 비밀번호를 아무리 바꿔도 로그인이 실패한다)
      const finalEmail = localUser.email || expectedEmail;
      if (finalEmail) {
        return NextResponse.json({ found: true, authEmail: finalEmail }, { status: 200 });
      }
    }

    if (phoneDigits) {
      const authEmail = `${phoneDigits}@modelbeauty.kr`;
      return NextResponse.json({ found: true, authEmail }, { status: 200 });
    }

    return NextResponse.json({ found: false }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/auth/get-auth-email]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ found: false, error: message }, { status: 500 });
  }
}


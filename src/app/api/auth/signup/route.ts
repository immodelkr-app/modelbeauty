// ============================================================
// API 라우트: 신규 회원가입 (강화판)
// POST /api/auth/signup
// ============================================================
// 닉네임/비밀번호 기반 회원가입:
// 1. im-core-auth 닉네임 중복 확인
// 2. Supabase Auth에 가상 이메일(`{phone}@modelbeauty.kr`)로 signUp
// 3. im-core-auth sync로 마스터 계정 생성/연결
// 4. 기존 타 앱 계정이 있으면 통합 안내
// 추가: 생년월일(년/월/일), 성별, 주소, 마케팅 동의 저장
//
// [MOCA/IMFF → 모델뷰티 유입 시 "이미 가입된 닉네임" 오탐 방지]
// MOCA·IMFF 로그인 시 im-core-auth가 MODEL_BEAUTY 매핑을 자동으로 만들어두는데(로컬 계정은 없음),
// 이 상태에서 그 닉네임 주인이 실제로 모델뷰티에 가입하려 하면 checkNicknameAvailable이
// "이미 가입된 닉네임"으로 오탐한다. 닉네임 소유자의 전화번호가 지금 가입하려는 사람의
// 전화번호와 같으면(=본인) 차단하지 않고 그대로 가입을 진행해 로컬 계정을 만들어준다.
// (아래 syncMasterUser 호출이 해당 MODEL_BEAUTY 매핑의 local_user_id를 새 계정으로 갱신한다)

import { NextRequest, NextResponse } from "next/server";
import { checkNicknameAvailable, getMasterUserByNickname, syncMasterUser } from "@/lib/core-auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nickname,
      realName,
      password,
      phoneNumber,
      birthDate,
      gender,
      zipcode,
      address,
      addressDetail,
      marketingEmail,
      marketingSms,
    } = body as {
      nickname?: string;
      realName?: string;
      password?: string;
      phoneNumber?: string;
      birthDate?: string;
      gender?: "male" | "female" | "other";
      zipcode?: string;
      address?: string;
      addressDetail?: string;
      marketingEmail?: boolean;
      marketingSms?: boolean;
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
    if (!zipcode?.trim() || !address?.trim()) {
      return NextResponse.json({ error: "배송을 위해 주소를 입력해주세요." }, { status: 400 });
    }
    if (!addressDetail?.trim()) {
      return NextResponse.json({ error: "상세 주소를 입력해주세요." }, { status: 400 });
    }

    const cleanNickname = nickname.trim();
    const cleanRealName = realName.trim();
    const phoneDigits = phoneNumber.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return NextResponse.json({ error: "올바른 휴대폰 번호를 입력해주세요." }, { status: 400 });
    }

    // ── 생년월일 유효성 (만 14세 이상) ──────────────────────
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      const age =
        today.getFullYear() -
        birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (age < 14) {
        return NextResponse.json({ error: "만 14세 이상만 가입하실 수 있습니다." }, { status: 400 });
      }
    }

    // ── 닉네임 중복 확인 (im-core-auth 통합 체크) ────────────
    const isAvailable = await checkNicknameAvailable(cleanNickname);
    if (!isAvailable) {
      // MOCA/IMFF에서 이미 쓰고 있는 "본인"의 닉네임일 수 있으므로
      // 닉네임 소유자의 전화번호를 확인해 본인이면 예외적으로 통과시킨다.
      let isOwnIdentity = false;
      try {
        const ownerRef = await getMasterUserByNickname(cleanNickname);
        const ownerPhoneDigits = ownerRef?.phoneNumber?.replace(/\D/g, "");
        isOwnIdentity = !!ownerPhoneDigits && ownerPhoneDigits === phoneDigits;
      } catch (e) {
        console.warn("[POST /api/auth/signup] 닉네임 소유자 확인 실패 (본인 여부 판단 불가):", e);
      }

      if (!isOwnIdentity) {
        return NextResponse.json(
          { error: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요." },
          { status: 409 }
        );
      }
      // 본인의 MOCA/IMFF 닉네임 → 모델뷰티 로컬 계정이 없는 상태이므로 가입을 계속 진행한다.
    }

    // ── Supabase Auth 가입 ────────────────────────────────────
    const authEmail = `${phoneDigits}@modelbeauty.kr`;
    const adminClient = createSupabaseAdmin();

    const now = new Date().toISOString();

    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: cleanNickname,
        real_name: cleanRealName,
        phone: phoneDigits,
        // 추가 프로필
        birth_date: birthDate || null,
        gender: gender || null,
        zipcode: zipcode || null,
        address: address || null,
        address_detail: addressDetail || null,
        // 마케팅 동의
        marketing_email: marketingEmail ?? false,
        marketing_sms: marketingSms ?? false,
        // 약관 동의 일시
        terms_agreed_at: now,
        privacy_agreed_at: now,
        ...(marketingEmail || marketingSms ? { marketing_agreed_at: now } : {}),
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
        // im-core-auth /api/auth/sync는 name 필드를 "닉네임"으로 저장한다(realName은 저장 안 함).
        // 여기 실명을 넣으면 마스터유저(모카/IMFF와 공유)의 닉네임이 실명으로 덮어써진다.
        name: cleanNickname,
        realName: cleanRealName,
        nickname: cleanNickname,
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
            birth_date: birthDate || null,
            gender: gender || null,
            zipcode: zipcode || null,
            address: address || null,
            address_detail: addressDetail || null,
            marketing_email: marketingEmail ?? false,
            marketing_sms: marketingSms ?? false,
            terms_agreed_at: now,
            privacy_agreed_at: now,
            ...(marketingEmail || marketingSms ? { marketing_agreed_at: now } : {}),
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

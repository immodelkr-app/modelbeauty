// ============================================================
// API 라우트: 관리자 직접 회원 등록
// POST /api/admin/users/create
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { checkNicknameAvailable, syncMasterUser } from "@/lib/core-auth";
import { requireAdmin } from "@/lib/auth-admin";

export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

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
      memo,
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
      memo?: string;
    };

    const adminClient = createSupabaseAdmin();

    // ── 유효성 검사 ──────────────────────────────────────────
    if (!nickname?.trim()) {
      return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
    }
    if (!realName?.trim()) {
      return NextResponse.json({ error: "실명을 입력해주세요." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "임시 비밀번호는 6자리 이상이어야 합니다." }, { status: 400 });
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

    // ── 닉네임 중복 확인 ─────────────────────────────────────
    const isAvailable = await checkNicknameAvailable(cleanNickname);
    if (!isAvailable) {
      return NextResponse.json(
        { error: "이미 사용 중인 닉네임입니다." },
        { status: 409 }
      );
    }

    // ── Supabase Auth 계정 생성 ───────────────────────────────
    const authEmail = `${phoneDigits}@modelbeauty.kr`;
    const now = new Date().toISOString();

    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
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
        admin_created: true,
        admin_memo: memo || null,
        ...(marketingEmail || marketingSms ? { marketing_agreed_at: now } : {}),
      },
    });

    if (signUpError || !authData.user) {
      if (signUpError?.message?.includes("already registered") || signUpError?.code === "email_exists") {
        return NextResponse.json(
          { error: "이미 가입된 휴대폰 번호입니다." },
          { status: 409 }
        );
      }
      console.error("[POST /api/admin/users/create] 계정 생성 실패:", signUpError);
      return NextResponse.json(
        { error: signUpError?.message || "회원 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    const localUserId = authData.user.id;

    // ── im-core-auth SSO 동기화 ───────────────────────────────
    try {
      const masterUser = await syncMasterUser({
        phoneNumber: phoneDigits,
        appName: "MODEL_BEAUTY",
        localUserId,
        // im-core-auth /api/auth/sync는 name 필드를 "닉네임"으로 저장한다(realName은 저장 안 함).
        // 여기 실명을 넣으면 마스터유저(모카/IMFF와 공유)의 닉네임이 실명으로 덮어써진다.
        name: cleanNickname,
        realName: cleanRealName,
        nickname: cleanNickname,
      });

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
            admin_created: true,
            admin_memo: memo || null,
          },
        });
      }
    } catch (syncErr) {
      console.warn("[POST /api/admin/users/create] im-core-auth 동기화 실패 (비중단):", syncErr);
    }

    return NextResponse.json(
      {
        success: true,
        userId: localUserId,
        message: `${cleanNickname}(${cleanRealName}) 회원이 등록되었습니다.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/users/create]", error);
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

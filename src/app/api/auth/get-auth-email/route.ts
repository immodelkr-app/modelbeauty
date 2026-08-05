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

    // 2. Supabase Auth 사용자 목록에서 fallback 조회 및 email 보정
    const adminClient = createSupabaseAdmin();
    const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

    const localUser = allUsers.find((u) => {
      const meta = u.user_metadata || {};
      const matchName = meta.name === cleanNickname || meta.nickname === cleanNickname || meta.real_name === cleanNickname;
      const matchPhone = phoneDigits && (meta.phone === phoneDigits || (u.phone && u.phone.replace(/\D/g, "").endsWith(phoneDigits)));
      return matchName || matchPhone;
    });

    if (localUser) {
      const rawPhone = (localUser.phone || localUser.user_metadata?.phone || phoneDigits || "").replace(/\D/g, "");
      const cleanPhone = rawPhone.length > 11 ? rawPhone.slice(-11) : rawPhone;
      const expectedEmail = cleanPhone ? `${cleanPhone}@modelbeauty.kr` : localUser.email;

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

      if (expectedEmail) {
        return NextResponse.json({ found: true, authEmail: expectedEmail }, { status: 200 });
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


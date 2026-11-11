// ============================================================
// API 라우트: 모카 → 모델뷰티 티켓 로그인
// GET /api/auth/moca-login?ticket=...
// ============================================================
// 모카 서버가 서명한 60초짜리 티켓을 검증하고, 해당 전화번호의 모델뷰티 계정으로
// 세션을 만든 뒤 티켓에 담긴 경로로 이동시킨다. 모델뷰티 계정이 없으면 새로 만든다.
// 티켓이 잘못되면 일반 로그인 화면으로 보낸다(로그인 우회는 절대 하지 않는다).
//
// shortcut: 티켓은 60초 만료만 있고 1회용 처리는 없음(서버리스라 사용 기록 저장소가 없음).
//           URL 유출로 인한 재사용이 우려되면 used_tickets 테이블로 jti 1회용 처리 추가.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { syncMasterUser } from "@/lib/core-auth";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";

interface TicketPayload {
  phone: string; // 숫자만 (예: 01012345678)
  nickname?: string;
  path: string; // 모델뷰티 내부 경로
  exp: number; // epoch ms
}

function verifyTicket(ticket: string | null): TicketPayload | null {
  const secret = process.env.MOCA_TICKET_SECRET;
  if (!secret || !ticket) return null;
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TicketPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (!/^01\d{8,9}$/.test(payload.phone ?? "")) return null;
    return payload;
  } catch {
    return null;
  }
}

// 오픈 리다이렉트 방지: 모델뷰티 내부 경로("/...")만 허용
function safePath(path: string | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function GET(request: NextRequest) {
  const payload = verifyTicket(request.nextUrl.searchParams.get("ticket"));
  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const target = safePath(payload.path);
  const fallback = NextResponse.redirect(
    new URL(`/login?redirect=${encodeURIComponent(target)}`, request.url)
  );

  try {
    const admin = createSupabaseAdmin();
    const phone = payload.phone;

    // 1. 기존 모델뷰티 계정 조회 (국내형식 → 국제형식 순)
    let local: { id: string; email: string | null } | null = null;
    for (const p of [phone, `82${phone.slice(1)}`]) {
      const { data } = await admin.rpc("find_local_auth_user", { p_phone: p, p_nickname: null });
      if (data?.[0]) {
        local = data[0];
        break;
      }
    }

    // 2. 없으면 가상 이메일 계정 신규 생성 (비밀번호는 설정하지 않음 → 이 통로로만 로그인 가능)
    let email = local?.email || `${phone}@modelbeauty.kr`;
    if (!local) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: payload.nickname ?? null, phone },
      });
      if (createError || !created.user) {
        console.error("[moca-login] 계정 생성 실패:", createError);
        return fallback;
      }
      try {
        await syncMasterUser({
          phoneNumber: phone,
          appName: "MODEL_BEAUTY",
          localUserId: created.user.id,
          name: payload.nickname,
          nickname: payload.nickname,
        });
      } catch (syncErr) {
        console.warn("[moca-login] im-core-auth sync 실패 (비중단):", syncErr);
      }
    } else if (!local.email) {
      // 이메일이 비어 있는 기존 계정은 규칙 이메일로 보정 (get-auth-email과 동일 규칙)
      await admin.auth.admin.updateUserById(local.id, { email, email_confirm: true });
    }

    // 3. 서버에서 로그인 링크 토큰을 만들고 바로 검증해 세션 쿠키 발급
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("[moca-login] 로그인 링크 생성 실패:", linkError);
      return fallback;
    }

    const supabase = await createSupabaseServerClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (verifyError) {
      console.error("[moca-login] 세션 발급 실패:", verifyError);
      return fallback;
    }

    // 4. 3시간 세션 타이머 기준 시각 기록 (session-timeout.ts와 동일한 쿠키)
    const cookieStore = await cookies();
    cookieStore.set("mb_login_at", String(Date.now()), {
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });

    return NextResponse.redirect(new URL(target, request.url));
  } catch (error) {
    console.error("[moca-login]", error);
    return fallback;
  }
}

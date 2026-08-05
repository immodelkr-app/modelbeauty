// ============================================================
// API 라우트: OTP 가입자 이메일 일괄 마이그레이션
// POST /api/admin/users/migrate-email
// ============================================================
// 이전에 전화번호 OTP 방식으로 가입되어 Supabase Auth의 email이
// 비어있는 모든 회원을 찾아 자동으로 {phone}@modelbeauty.kr 이메일을
// 할당하여 닉네임+비밀번호 로그인이 가능하도록 일괄 보정합니다.
// ============================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** E.164 또는 국제번호 형식 → 한국 로컬 번호(01XXXXXXXXX) 변환 */
function toKoreanLocal(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  // 821XXXXXXXXX → 01XXXXXXXXX
  if (digits.startsWith("82") && digits.length >= 12) {
    return "0" + digits.slice(2);
  }
  // 이미 01로 시작하면 그대로
  if (digits.startsWith("01")) {
    return digits;
  }
  // 그 외 (예: 1XXXXXXXXX 등) — 그대로 반환
  return digits;
}

export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const admin = createSupabaseAdmin();

  // ── 1. 전체 Supabase Auth 사용자 조회 ─────────────────────
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("[migrate-email] listUsers 실패:", listErr);
    return NextResponse.json({ success: false, error: "사용자 목록 조회 실패" }, { status: 500 });
  }

  // ── 2. 이메일이 비어있고 phone 번호가 있는 사용자 필터링 ──
  const targets = users.filter((u) => {
    const hasEmptyEmail = !u.email || u.email.trim() === "";
    const rawPhone = u.phone || u.user_metadata?.phone || "";
    return hasEmptyEmail && rawPhone;
  });

  console.log(`[migrate-email] 총 ${users.length}명 중 마이그레이션 대상: ${targets.length}명`);

  // ── 3. 이메일이 있는 사용자 중 phone이 있는 경우도 체크 ──
  // (email이 있더라도 @modelbeauty.kr 형식이 아닌 OTP 전화번호 유저는 별도 처리 불필요)
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const details: { id: string; name: string; phone: string; email: string; status: string }[] = [];

  for (const user of targets) {
    const rawPhone = user.phone || user.user_metadata?.phone || "";
    const localPhone = toKoreanLocal(rawPhone);

    // 유효한 한국 번호 형식이 아닌 경우 스킵
    if (!localPhone.startsWith("01") || localPhone.length < 10) {
      skipped++;
      details.push({
        id: user.id,
        name: user.user_metadata?.name ?? "",
        phone: rawPhone,
        email: "",
        status: "skipped_invalid_phone",
      });
      continue;
    }

    const authEmail = `${localPhone}@modelbeauty.kr`;

    try {
      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
        email: authEmail,
        email_confirm: true,
      });

      if (updateErr) {
        // 이미 같은 이메일로 다른 계정이 있으면 건너뜀
        console.warn(`[migrate-email] updateUser 실패 (id=${user.id}):`, updateErr.message);
        failed++;
        details.push({
          id: user.id,
          name: user.user_metadata?.name ?? "",
          phone: localPhone,
          email: authEmail,
          status: `failed: ${updateErr.message}`,
        });
      } else {
        migrated++;
        details.push({
          id: user.id,
          name: user.user_metadata?.name ?? "",
          phone: localPhone,
          email: authEmail,
          status: "migrated",
        });
      }
    } catch (e) {
      console.error(`[migrate-email] 예외 (id=${user.id}):`, e);
      failed++;
      details.push({
        id: user.id,
        name: user.user_metadata?.name ?? "",
        phone: localPhone,
        email: authEmail,
        status: "exception",
      });
    }
  }

  console.log(`[migrate-email] 완료 — 마이그레이션: ${migrated}, 실패: ${failed}, 스킵: ${skipped}`);

  return NextResponse.json({
    success: true,
    result: {
      total: users.length,
      targets: targets.length,
      migrated,
      failed,
      skipped,
    },
    details,
  });
}

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const admin = createSupabaseAdmin();

  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ success: false, error: "사용자 목록 조회 실패" }, { status: 500 });
  }

  // 마이그레이션이 필요한 대상만 미리 조회 (dry-run)
  const targets = users.filter((u) => {
    const hasEmptyEmail = !u.email || u.email.trim() === "";
    const rawPhone = u.phone || u.user_metadata?.phone || "";
    return hasEmptyEmail && rawPhone;
  });

  const preview = targets.map((u) => {
    const rawPhone = u.phone || u.user_metadata?.phone || "";
    const localPhone = toKoreanLocal(rawPhone);
    const authEmail = localPhone.startsWith("01") ? `${localPhone}@modelbeauty.kr` : null;
    return {
      id: u.id,
      name: u.user_metadata?.name ?? "",
      phone: localPhone,
      willGetEmail: authEmail,
      createdAt: u.created_at,
    };
  });

  return NextResponse.json({
    success: true,
    total: users.length,
    targets: targets.length,
    preview,
  });
}

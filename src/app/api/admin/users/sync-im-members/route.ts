// ============================================================
// API 라우트: 아임모델 공화국 회원 → 모델뷰티 자동 동기화
// POST /api/admin/users/sync-im-members
// ============================================================
// im-core-auth 전체 회원을 조회하여 모델뷰티 Supabase Auth에
// 미등록 회원은 신규 생성하고 기존 회원은 닉네임/이메일 최신화합니다.
// ============================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { listMasterMembers } from "@/lib/core-auth";

/** 페이지 단위로 아임모델 공화국 회원을 모두 가져옴 */
async function fetchAllMasterMembers() {
  const PAGE_SIZE = 500;
  let offset = 0;
  let total = Infinity;
  const all: Awaited<ReturnType<typeof listMasterMembers>>["members"] = [];

  while (all.length < total) {
    const { members, total: t } = await listMasterMembers({ limit: PAGE_SIZE, offset });
    total = t;
    if (members.length === 0) break;
    all.push(...members);
    offset += members.length;
    if (members.length < PAGE_SIZE) break;
  }

  return all;
}

export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const admin = createSupabaseAdmin();

  // ── 1. 아임모델 공화국 전체 회원 조회 ───────────────────
  let masterMembers: Awaited<ReturnType<typeof fetchAllMasterMembers>>;
  try {
    masterMembers = await fetchAllMasterMembers();
  } catch (err) {
    console.error("[sync-im-members] im-core-auth 회원 목록 조회 실패:", err);
    return NextResponse.json(
      { success: false, error: "아임모델 공화국 회원 목록 조회에 실패했습니다." },
      { status: 502 }
    );
  }

  if (masterMembers.length === 0) {
    return NextResponse.json({ success: true, result: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 } });
  }

  // ── 2. 기존 모델뷰티 Supabase Auth 회원 전체 조회 ───────
  // master_user_id → supabase user id 매핑 테이블 구성
  const { data: { users: supabaseUsers }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("[sync-im-members] Supabase user listUsers 실패:", listErr);
    return NextResponse.json(
      { success: false, error: "Supabase 회원 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }

  // master_user_id → supabase user
  const byMasterId = new Map<string, (typeof supabaseUsers)[number]>();
  // phoneNumber → supabase user
  const byPhone = new Map<string, (typeof supabaseUsers)[number]>();
  // email → supabase user
  const byEmail = new Map<string, (typeof supabaseUsers)[number]>();

  for (const u of supabaseUsers) {
    const mid = u.user_metadata?.master_user_id;
    if (mid) byMasterId.set(mid, u);
    if (u.phone) byPhone.set(u.phone.replace(/\D/g, ""), u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
  }

  // ── 3. 회원별 신규 생성 / 업데이트 처리 ────────────────
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of masterMembers) {
    const normalizedPhone = member.phoneNumber?.replace(/\D/g, "") ?? "";

    // 기존 Supabase 회원 탐색: master_user_id → phone → email 순서로 매핑
    const existing =
      byMasterId.get(member.id) ??
      (normalizedPhone ? byPhone.get(normalizedPhone) : undefined) ??
      (member.email ? byEmail.get(member.email.toLowerCase()) : undefined);

    const userMeta = {
      master_user_id: member.id,
      name: member.name ?? undefined,
      real_name: member.realName ?? undefined,
    };

    if (existing) {
      // ── 기존 회원: master_user_id 및 닉네임 최신화 ──────
      const currentMasterId = existing.user_metadata?.master_user_id;
      const currentName = existing.user_metadata?.name;
      const needsUpdate =
        currentMasterId !== member.id ||
        currentName !== member.name;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      try {
        await admin.auth.admin.updateUserById(existing.id, {
          user_metadata: {
            ...existing.user_metadata,
            ...userMeta,
          },
        });
        // 캐시 갱신
        byMasterId.set(member.id, existing);
        updated++;
      } catch (e) {
        console.error(`[sync-im-members] updateUser 실패 (master=${member.id}):`, e);
        failed++;
      }
    } else {
      // ── 신규 회원: Supabase Auth에 자동 등록 ────────────
      // 비밀번호 없이 생성 (OTP 기반 로그인 전제)
      try {
        const createPayload: Parameters<typeof admin.auth.admin.createUser>[0] = {
          user_metadata: userMeta,
          email_confirm: true,
          phone_confirm: true,
        };

        if (normalizedPhone) {
          // E.164 형식으로 변환 시도
          createPayload.phone = normalizedPhone.startsWith("82")
            ? `+${normalizedPhone}`
            : normalizedPhone.startsWith("0")
            ? `+82${normalizedPhone.slice(1)}`
            : `+${normalizedPhone}`;
        }
        if (member.email) {
          createPayload.email = member.email;
        }

        const { data: newUser, error: createErr } = await admin.auth.admin.createUser(createPayload);

        if (createErr) {
          console.error(`[sync-im-members] createUser 실패 (master=${member.id}):`, createErr.message);
          failed++;
        } else if (newUser?.user) {
          byMasterId.set(member.id, newUser.user);
          if (normalizedPhone) byPhone.set(normalizedPhone, newUser.user);
          if (member.email) byEmail.set(member.email.toLowerCase(), newUser.user);
          created++;
        }
      } catch (e) {
        console.error(`[sync-im-members] createUser 예외 (master=${member.id}):`, e);
        failed++;
      }
    }
  }

  console.log(`[sync-im-members] 완료 — 전체: ${masterMembers.length}, 생성: ${created}, 업데이트: ${updated}, 스킵: ${skipped}, 실패: ${failed}`);

  return NextResponse.json({
    success: true,
    result: {
      total: masterMembers.length,
      created,
      updated,
      skipped,
      failed,
    },
  });
}

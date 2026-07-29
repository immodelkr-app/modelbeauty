// ============================================================
// API 라우트: 관리자용 전체 회원 목록 조회
// GET /api/admin/users
// ============================================================
// im-core-auth 기준 전체 마스터 회원 조회 + Supabase Auth enrichment
// → MOCA·IMFF·모델뷰티 어느 앱 가입자든 모두 표시

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { listMasterMembers } from "@/lib/core-auth";

export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();

    // ── 1. 아임모델 공화국에서 전체 마스터 회원 조회 (Source of Truth) ──
    let masterMembers: Awaited<ReturnType<typeof listMasterMembers>>["members"] = [];
    try {
      const PAGE_SIZE = 500;
      let offset = 0;
      let total = Infinity;
      while (masterMembers.length < total) {
        const { members, total: t } = await listMasterMembers({ limit: PAGE_SIZE, offset });
        total = t;
        if (members.length === 0) break;
        masterMembers.push(...members);
        offset += members.length;
        if (members.length < PAGE_SIZE) break;
      }
    } catch (coreAuthErr) {
      console.warn("[/api/admin/users] im-core-auth 회원 목록 조회 실패, Supabase 기준으로 폴백:", coreAuthErr);
    }

    // ── 2. Supabase Auth 회원 전체 조회 (로그인 이력·계정 존재 여부 enrichment) ──
    const { data: { users: supabaseUsers }, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    // masterUserId → Supabase 유저 매핑
    const supabaseByMasterId = new Map<string, (typeof supabaseUsers)[number]>();
    const supabaseByPhone = new Map<string, (typeof supabaseUsers)[number]>();
    for (const u of supabaseUsers) {
      const mid = u.user_metadata?.master_user_id;
      if (mid) supabaseByMasterId.set(mid, u);
      const phone = (u.user_metadata?.phone || "").replace(/\D/g, "");
      if (phone) supabaseByPhone.set(phone, u);
    }

    const ALL_TIERS = [
      { id: "normal",  name: "일반",    badge_emoji: "🩶", sort_order: 1 },
      { id: "silver",  name: "실버",    badge_emoji: "🥈", sort_order: 2 },
      { id: "gold",    name: "골드",    badge_emoji: "🥇", sort_order: 3 },
      { id: "imodel",  name: "아임모델", badge_emoji: "⭐", sort_order: 4 },
      { id: "vip",     name: "VIP",     badge_emoji: "💎", sort_order: 5 },
    ];
    const tierMap = new Map(ALL_TIERS.map((t) => [t.id, t]));
    const defaultTier = ALL_TIERS[0];

    // ── 3. im-core-auth 회원이 있으면 그것을 기준으로, 없으면 Supabase 기준 폴백 ──
    if (masterMembers.length > 0) {
      const formattedUsers = masterMembers.map((m) => {
        const normalizedPhone = m.phoneNumber.replace(/\D/g, "");
        const supabaseUser =
          supabaseByMasterId.get(m.id) ??
          (normalizedPhone ? supabaseByPhone.get(normalizedPhone) : undefined);

        const gradeCode = (m.grade || "NORMAL").toLowerCase();
        const tier = tierMap.get(gradeCode) ?? defaultTier;

        return {
          // 상세 조회 시 사용할 식별자: masterUserId 우선
          id: supabaseUser?.id ?? m.id, // Supabase uid (없으면 masterUserId로 대체)
          masterUserId: m.id,
          email: m.email ?? supabaseUser?.email ?? null,
          phone: m.phoneNumber || supabaseUser?.phone || null,
          name: m.name ?? supabaseUser?.user_metadata?.name ?? null,
          realName: m.realName ?? supabaseUser?.user_metadata?.real_name ?? null,
          createdAt: supabaseUser?.created_at ?? m.createdAt ?? new Date().toISOString(),
          lastSignInAt: supabaseUser?.last_sign_in_at ?? null,
          tier,
          isLocked: m.grade_locked,
          linkedApps: m.linkedApps,
          hasModelBeautyAccount: !!supabaseUser,
        };
      });

      // 가입일 기준 최신순 정렬
      formattedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return NextResponse.json({ success: true, users: formattedUsers });
    }

    // ── 폴백: im-core-auth 연결 실패 시 기존 Supabase 기준 표시 ──
    const formattedUsers = supabaseUsers.map((u) => {
      const masterUserId = u.user_metadata?.master_user_id || u.id;
      return {
        id: u.id,
        masterUserId,
        email: u.email || null,
        phone: u.phone || null,
        name: u.user_metadata?.name || null,
        realName: u.user_metadata?.real_name ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        tier: defaultTier,
        isLocked: false,
        linkedApps: ["MODEL_BEAUTY"],
        hasModelBeautyAccount: true,
      };
    });

    formattedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

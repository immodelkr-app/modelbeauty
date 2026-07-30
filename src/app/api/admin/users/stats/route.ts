// ============================================================
// GET /api/admin/users/stats — 대시보드용 경량 회원 통계
// 회원 목록 전체를 내려주지 않고 집계값만 빠르게 반환
// ============================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { listMasterMembers } from "@/lib/core-auth";
import { getBulkTierMap, toTierDto } from "@/lib/membership";

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();

    // ── 1. 마스터 회원 목록 (id + linkedApps + phone 정도만 필요) ──
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
    } catch {
      // 폴백: Supabase만으로 집계
    }

    // ── 2. Supabase Auth 회원 (가입 여부 판별용) ──
    const { data: { users: supabaseUsers }, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const supabaseByMasterId = new Set(
      supabaseUsers.map((u) => u.user_metadata?.master_user_id).filter(Boolean)
    );
    const supabaseByPhone = new Set(
      supabaseUsers.map((u) => (u.user_metadata?.phone || "").replace(/\D/g, "")).filter(Boolean)
    );

    // ── 3. 집계 ──
    const source = masterMembers.length > 0 ? masterMembers : supabaseUsers.map((u) => ({
      id: u.user_metadata?.master_user_id || u.id,
      phoneNumber: u.phone || "",
      linkedApps: ["MODEL_BEAUTY"] as string[],
      // 나머지 필드는 집계에 불필요
      email: u.email ?? null,
      name: u.user_metadata?.name ?? null,
      realName: null,
      createdAt: u.created_at,
    }));

    const ids = (masterMembers.length > 0 ? masterMembers : supabaseUsers.map((u) => ({
      id: u.user_metadata?.master_user_id || u.id,
    }))).map((m) => m.id);

    const tierMap = await getBulkTierMap(ids);

    const tierCounts = new Map<string, { tierName: string; badgeEmoji: string; count: number }>();
    const appCounts: Record<string, number> = {};
    let hasModelBeauty = 0;
    let noModelBeauty = 0;

    for (const m of source) {
      // 등급별
      const membership = tierMap.get(m.id);
      if (membership) {
        const dto = toTierDto(membership.tier);
        const prev = tierCounts.get(dto.id) ?? { tierName: dto.name, badgeEmoji: dto.badge_emoji, count: 0 };
        tierCounts.set(dto.id, { ...prev, count: prev.count + 1 });
      }

      // 모델뷰티 가입 여부
      const normalizedPhone = (m.phoneNumber || "").replace(/\D/g, "");
      const hasAcc =
        supabaseByMasterId.has(m.id) ||
        (normalizedPhone ? supabaseByPhone.has(normalizedPhone) : false);
      if (hasAcc) hasModelBeauty++; else noModelBeauty++;

      // 앱별
      for (const app of (m.linkedApps ?? [])) {
        appCounts[app] = (appCounts[app] ?? 0) + 1;
      }
    }

    const byTier = Array.from(tierCounts.entries())
      .map(([tierId, v]) => ({ tierId, tierName: v.tierName, badgeEmoji: v.badgeEmoji, count: v.count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      stats: {
        total: source.length,
        byTier,
        hasModelBeauty,
        noModelBeauty,
        byApp: appCounts,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/users/stats] Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

// ============================================================
// membership.ts — 모델뷰티 자체 회원등급 시스템
// ============================================================
// im-core-auth의 grade 필드와 완전히 분리된, 모델뷰티 로컬 DB
// (model_beauty.membership_tiers / user_memberships) 기준의
// 단일 소스 등급 계산·조회·수동 조정 로직.

import { createSupabaseAdmin } from "@/lib/supabase/server";

export interface MembershipTier {
  id: string;
  name: string;
  sortOrder: number;
  minAmount: number;
  discountRate: number;
  badgeEmoji: string;
}

export interface MembershipStatus {
  tier: MembershipTier;
  isLocked: boolean;
  lockReason: string | null;
  totalPurchasedLast6m: number;
  nextTier: MembershipTier | null;
  amountToNextTier: number;
  allTiers: MembershipTier[];
}

/** 프론트엔드가 기대하는 snake_case 응답 형태로 변환 (기존 API 계약 유지) */
export function toTierDto(tier: MembershipTier) {
  return {
    id: tier.id,
    name: tier.name,
    sort_order: tier.sortOrder,
    min_amount: tier.minAmount,
    discount_rate: tier.discountRate,
    badge_emoji: tier.badgeEmoji,
  };
}

export async function getAllTiers(): Promise<MembershipTier[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("membership_tiers")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    sortOrder: t.sort_order,
    minAmount: t.min_amount,
    discountRate: t.discount_rate,
    badgeEmoji: t.badge_emoji,
  }));
}

async function getSixMonthPurchaseTotal(masterUserId: string): Promise<number> {
  const admin = createSupabaseAdmin();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data } = await admin
    .from("orders")
    .select("total_amount")
    .eq("master_user_id", masterUserId)
    .eq("status", "confirmed")
    .gte("created_at", sixMonthsAgo.toISOString());

  return (data ?? []).reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
}

function pickTierForAmount(tiers: MembershipTier[], amount: number): MembershipTier {
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  let picked = sorted[0];
  for (const t of sorted) {
    if (amount >= t.minAmount) picked = t;
  }
  return picked;
}

/**
 * 회원의 현재 등급 상태를 조회합니다.
 *
 * 등급 자체는 여기서 재계산하지 않습니다 — 재계산은 관리자가 실행하는
 * recalculateAllMemberships()(1월/7월 배치) 또는 setMembershipOverride()(수동 지정)
 * 시점에만 일어납니다. 그렇지 않으면 관리자가 수동으로 지정한 등급이 바로 다음
 * 조회(마이페이지 새로고침 등)에서 자동 계산값으로 덮어써지는 문제가 생깁니다.
 * "최근 6개월 구매액"과 "다음 등급까지 남은 금액"은 진행률 표시를 위해 항상
 * 실시간으로 계산합니다. 등급 레코드가 아예 없는 신규 회원만 이번 조회에서
 * 1회 초기값을 계산해 생성합니다.
 */
export async function getMembershipStatus(masterUserId: string): Promise<MembershipStatus> {
  const admin = createSupabaseAdmin();
  const [tiers, totalPurchasedLast6m] = await Promise.all([
    getAllTiers(),
    getSixMonthPurchaseTotal(masterUserId),
  ]);

  const { data: existing } = await admin
    .from("user_memberships")
    .select("tier_id, is_locked, lock_reason")
    .eq("master_user_id", masterUserId)
    .maybeSingle();

  let tierId = existing?.tier_id;

  if (!existing) {
    // 등급 레코드가 없는 신규 회원 — 1회 초기값 생성 (기존 값을 덮어쓰는 것이 아님)
    const initialTier = pickTierForAmount(tiers, totalPurchasedLast6m);
    await admin.from("user_memberships").upsert(
      {
        master_user_id: masterUserId,
        tier_id: initialTier.id,
        is_locked: false,
        last_recalc_at: new Date().toISOString(),
      },
      { onConflict: "master_user_id" }
    );
    tierId = initialTier.id;
  }

  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const nextTier = tiers.find((t) => t.sortOrder > tier.sortOrder) ?? null;

  return {
    tier,
    isLocked: existing?.is_locked ?? false,
    lockReason: existing?.lock_reason ?? null,
    totalPurchasedLast6m,
    nextTier,
    amountToNextTier: nextTier ? Math.max(0, nextTier.minAmount - totalPurchasedLast6m) : 0,
    allTiers: tiers,
  };
}

/**
 * 관리자가 회원 등급을 수동으로 지정하거나 자동 재산정을 잠급니다.
 */
export async function setMembershipOverride(
  masterUserId: string,
  params: { tierId?: string; isLocked?: boolean; lockReason?: string | null; lockedBy?: string | null }
): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("user_memberships")
    .select("tier_id")
    .eq("master_user_id", masterUserId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    master_user_id: masterUserId,
    tier_id: params.tierId ?? existing?.tier_id ?? "normal",
    last_recalc_at: new Date().toISOString(),
  };

  if (params.isLocked !== undefined) {
    payload.is_locked = params.isLocked;
    payload.lock_reason = params.isLocked ? params.lockReason ?? null : null;
    payload.locked_by = params.isLocked ? params.lockedBy ?? null : null;
    payload.locked_at = params.isLocked ? new Date().toISOString() : null;
  }

  const { error } = await admin
    .from("user_memberships")
    .upsert(payload, { onConflict: "master_user_id" });

  if (error) throw error;
}

export interface BulkMembershipEntry {
  tier: MembershipTier;
  isLocked: boolean;
}

/**
 * 여러 회원의 현재 등급/잠금 상태를 한 번에 조회합니다 (어드민 회원 목록용, N+1 방지).
 * 등급 레코드가 없는 회원은 기본 최하위 등급 + 잠금 없음으로 처리합니다.
 */
export async function getBulkTierMap(
  masterUserIds: string[]
): Promise<Map<string, BulkMembershipEntry>> {
  const tiers = await getAllTiers();
  const defaultTier = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder)[0];

  const result = new Map<string, BulkMembershipEntry>();
  for (const id of masterUserIds) result.set(id, { tier: defaultTier, isLocked: false });
  if (masterUserIds.length === 0) return result;

  const admin = createSupabaseAdmin();
  const tierById = new Map(tiers.map((t) => [t.id, t]));

  const { data } = await admin
    .from("user_memberships")
    .select("master_user_id, tier_id, is_locked")
    .in("master_user_id", masterUserIds);

  for (const row of data ?? []) {
    const t = tierById.get(row.tier_id);
    if (t) result.set(row.master_user_id, { tier: t, isLocked: row.is_locked ?? false });
  }

  return result;
}

/**
 * 전체 회원 등급 일괄 재산정 (관리자 배치 실행용).
 * 잠긴(is_locked) 회원은 제외합니다.
 */
export async function recalculateAllMemberships(): Promise<{
  total: number;
  upgraded: number;
  downgraded: number;
  unchanged: number;
}> {
  const admin = createSupabaseAdmin();
  const tiers = await getAllTiers();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [{ data: recentOrders }, { data: membershipRows }] = await Promise.all([
    admin
      .from("orders")
      .select("master_user_id, total_amount")
      .eq("status", "confirmed")
      .gte("created_at", sixMonthsAgo.toISOString()),
    admin.from("user_memberships").select("master_user_id, tier_id, is_locked"),
  ]);

  const totalsByUser = new Map<string, number>();
  for (const o of recentOrders ?? []) {
    if (!o.master_user_id) continue;
    totalsByUser.set(o.master_user_id, (totalsByUser.get(o.master_user_id) ?? 0) + (o.total_amount ?? 0));
  }

  const lockedSet = new Set(
    (membershipRows ?? []).filter((r) => r.is_locked).map((r) => r.master_user_id)
  );
  const currentTierMap = new Map((membershipRows ?? []).map((r) => [r.master_user_id, r.tier_id]));

  // 재산정 대상: 최근 6개월 주문 이력이 있는 회원 + 기존 등급 레코드가 있는 회원
  // (구매가 끊겨 강등되어야 할 회원도 포함하기 위함)
  const targetIds = new Set<string>([...totalsByUser.keys(), ...currentTierMap.keys()]);

  let upgraded = 0;
  let downgraded = 0;
  let unchanged = 0;
  const upserts: { master_user_id: string; tier_id: string; is_locked: boolean; last_recalc_at: string }[] = [];

  for (const masterUserId of targetIds) {
    if (lockedSet.has(masterUserId)) continue;

    const total = totalsByUser.get(masterUserId) ?? 0;
    const newTier = pickTierForAmount(tiers, total);
    const currentTierId = currentTierMap.get(masterUserId) ?? "normal";

    if (newTier.id !== currentTierId) {
      const currentTier = tiers.find((t) => t.id === currentTierId) ?? tiers[0];
      if (newTier.sortOrder > currentTier.sortOrder) upgraded++;
      else downgraded++;
      upserts.push({
        master_user_id: masterUserId,
        tier_id: newTier.id,
        is_locked: false,
        last_recalc_at: new Date().toISOString(),
      });
    } else {
      unchanged++;
    }
  }

  if (upserts.length > 0) {
    const { error } = await admin
      .from("user_memberships")
      .upsert(upserts, { onConflict: "master_user_id" });
    if (error) throw error;
  }

  return { total: targetIds.size, upgraded, downgraded, unchanged };
}

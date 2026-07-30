// ============================================================
// GET /api/admin/membership/[userId] — 특정 회원 등급 상세 조회
// PUT  /api/admin/membership/[userId] — 회원 등급 수동 변경 / 잠금 설정
// ============================================================
// im-core-auth와 무관하게 모델뷰티 로컬 DB(주문 이력) 기준으로만 계산합니다.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMembershipStatus, setMembershipOverride, toTierDto } from "@/lib/membership";

/**
 * GET /api/admin/membership/[userId] — 특정 회원 등급 상세 조회
 * 현재 등급 + 6개월 누적 구매액 + 잠금 상태
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { userId } = await params;

  try {
    const status = await getMembershipStatus(userId);

    return NextResponse.json({
      success: true,
      data: {
        masterUserId: userId,
        currentTier: toTierDto(status.tier),
        isLocked: status.isLocked,
        lockReason: status.lockReason,
        lockedAt: null,
        lastRecalcAt: null,
        totalPurchasedLast6m: status.totalPurchasedLast6m,
        nextTier: status.nextTier ? toTierDto(status.nextTier) : null,
        amountToNextTier: status.amountToNextTier,
        allTiers: status.allTiers.map(toTierDto),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/membership/[userId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/membership/[userId] — 회원 등급 수동 변경 / 잠금 설정
 * body: { tierId?, isLocked?, lockReason? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { userId } = await params;

  try {
    const body = await request.json();
    const { tierId, isLocked, lockReason } = body;

    const supabase = await createSupabaseServerClient();
    const { data: { user: adminUser } } = await supabase.auth.getUser();

    await setMembershipOverride(userId, {
      tierId,
      isLocked,
      lockReason,
      lockedBy: adminUser?.email ?? adminUser?.id ?? null,
    });

    const status = await getMembershipStatus(userId);

    return NextResponse.json({
      success: true,
      data: {
        master_user_id: userId,
        tier_id: status.tier.id,
        is_locked: status.isLocked,
        lock_reason: status.lockReason,
      },
    });
  } catch (err) {
    console.error("[PUT /api/admin/membership/[userId]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

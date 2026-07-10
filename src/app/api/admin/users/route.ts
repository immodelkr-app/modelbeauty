// ============================================================
// API 라우트: 관리자용 전체 회원 목록 조회
// GET /api/admin/users
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getBulkMasterUsers } from "@/lib/core-auth";

export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    
    // Supabase Auth Admin API를 통해 프로젝트 전체 가입자 조회
    const { data: { users }, error } = await admin.auth.admin.listUsers();
    
    if (error) throw error;

    // 아임모델 공화국 통합 등급 일괄 조회
    const masterUserIds = users.map((u) => u.user_metadata?.master_user_id || u.id);
    let memberships: any[] = [];
    try {
      memberships = await getBulkMasterUsers(masterUserIds);
    } catch (bulkErr) {
      console.warn("[/api/admin/users] 아임모델 공화국 등급 벌크 조회 실패, 기본값 대체:", bulkErr);
    }

    const ALL_TIERS = [
      { id: "normal", name: "일반", badge_emoji: "🩶", sort_order: 1 },
      { id: "silver", name: "실버", badge_emoji: "🥈", sort_order: 2 },
      { id: "gold", name: "골드", badge_emoji: "🥇", sort_order: 3 },
      { id: "imodel", name: "아임모델", badge_emoji: "⭐", sort_order: 4 },
      { id: "vip", name: "VIP", badge_emoji: "💎", sort_order: 5 },
    ];

    const membershipMap = new Map((memberships ?? []).map((m) => [m.id, m]));
    const tierMap = new Map(ALL_TIERS.map((t) => [t.id, t]));
    const defaultTier = ALL_TIERS[0];

    // 데이터를 가공하여 필요한 정보만 전송
    const formattedUsers = users.map((u) => {
      const masterUserId = u.user_metadata?.master_user_id || u.id;
      const membership = membershipMap.get(masterUserId);
      const gradeCode = (membership?.grade || "NORMAL").toLowerCase();
      const tier = tierMap.get(gradeCode) ?? defaultTier;
      return {
        id: u.id,
        email: u.email || null,
        phone: u.phone || null,
        name: u.user_metadata?.name || null,
        masterUserId,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        tier,
        isLocked: membership?.grade_locked ?? false,
      };
    });

    // 가입일 기준 최신순 정렬
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

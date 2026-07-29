// ============================================================
// API 라우트: 관리자용 특정 회원 상세 정보 조회
// GET /api/admin/users/[id]
// ============================================================
// [id]는 Supabase Auth userId 또는 masterUserId가 올 수 있음
// masterUserId 기반으로 im-core-auth 실명·연동앱 정보도 반환

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getPointBalance, getAvailableCoupons, getMasterUser } from "@/lib/core-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();

    // ── Supabase Auth에서 유저 조회 시도 ─────────────────────
    let authUser: any = null;
    let masterUserId: string = id;

    const { data: { user: byId }, error: authError } = await admin.auth.admin.getUserById(id);

    if (!authError && byId) {
      // 정상적으로 Supabase Auth 유저 찾음
      authUser = byId;
      masterUserId = byId.user_metadata?.master_user_id || byId.id;
    } else {
      // Supabase Auth에 없는 경우 (MOCA·IMFF 전용 유저) → masterUserId로 처리
      // masterUserId로 Supabase 유저 탐색
      const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUser = allUsers.find((u) => u.user_metadata?.master_user_id === id) ?? null;
      masterUserId = id;
    }

    // ── im-core-auth에서 마스터 유저 상세 조회 ───────────────
    let masterUserDetail: any = null;
    try {
      masterUserDetail = await getMasterUser(masterUserId);
    } catch {
      console.warn(`[/api/admin/users/${id}] im-core-auth 마스터 유저 조회 실패`);
    }

    // ── 주문 내역 조회 (masterUserId 기준) ─────────────────
    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id, order_number, total_amount, status, created_at")
      .eq("master_user_id", masterUserId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // ── im-core-auth 포인트 및 쿠폰 조회 ─────────────────────
    let points = 0;
    let coupons: any[] = [];
    let isOffline = false;

    try {
      const pointData = await getPointBalance(masterUserId);
      points = pointData.integratedPoints;
      const couponData = await getAvailableCoupons(masterUserId);
      coupons = couponData || [];
    } catch (coreAuthError) {
      console.warn(`[/api/admin/users/${id}] im-core-auth 포인트/쿠폰 연동 실패:`, coreAuthError);
      isOffline = true;
    }

    const totalOrdersCount = orders?.length ?? 0;
    const totalSpent = orders?.reduce((sum, o) => o.status !== "cancelled" ? sum + o.total_amount : sum, 0) ?? 0;

    // im-core-auth에서 실명·연동앱 정보 추출
    const realName = masterUserDetail?.realName ?? masterUserDetail?.real_name
      ?? authUser?.user_metadata?.real_name ?? null;
    const linkedApps: string[] = masterUserDetail?.linkedApps ?? [];
    const hasModelBeautyAccount = !!authUser;

    return NextResponse.json({
      success: true,
      user: {
        id: authUser?.id ?? masterUserId,
        masterUserId,
        email: authUser?.email ?? masterUserDetail?.email ?? null,
        phone: authUser?.phone ?? masterUserDetail?.phoneNumber ?? null,
        name: authUser?.user_metadata?.name ?? masterUserDetail?.name ?? null,
        realName,
        createdAt: authUser?.created_at ?? masterUserDetail?.createdAt ?? null,
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        points,
        coupons,
        ordersSummary: { count: totalOrdersCount, spent: totalSpent },
        orders: orders || [],
        linkedApps,
        hasModelBeautyAccount,
        _coreAuthOffline: isOffline,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/users/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id] — 관리자 권한 회원 강제 탈퇴/삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: userId } = await params;
    const admin = createSupabaseAdmin();

    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`[DELETE /api/admin/users/${userId}] Supabase Auth error:`, error);
      return NextResponse.json({ success: false, error: "회원 삭제 중 오류가 발생했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "회원이 성공적으로 강제 탈퇴 처리되었습니다.",
    });
  } catch (error) {
    console.error("[DELETE /api/admin/users/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

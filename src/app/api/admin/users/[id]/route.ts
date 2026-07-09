// ============================================================
// API 라우트: 관리자용 특정 회원 상세 정보 조회 (포인트, 쿠폰, 주문 내역 연동)
// GET /api/admin/users/[id]
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getPointBalance, getAvailableCoupons } from "@/lib/core-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: masterUserId } = await params;
    const admin = createSupabaseAdmin();

    // 1. Supabase Auth에서 유저 정보 조회
    const { data: { user: authUser }, error: authError } = await admin.auth.admin.getUserById(masterUserId);
    if (authError || !authUser) {
      return NextResponse.json({ success: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 2. local DB에서 주문 내역 조회
    const { data: orders, error: ordersError } = await admin
      .from("orders")
      .select("id, order_number, total_amount, status, created_at")
      .eq("master_user_id", masterUserId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    // 3. im-core-auth 서버에서 포인트 및 쿠폰 잔액 조회 (전화번호 계정인 경우에만 조회)
    let points = 0;
    let coupons: any[] = [];
    let isOffline = false;

    if (authUser.phone) {
      try {
        const pointData = await getPointBalance(masterUserId);
        points = pointData.integratedPoints;

        const couponData = await getAvailableCoupons(masterUserId);
        coupons = couponData || [];
      } catch (coreAuthError) {
        console.warn(`[/api/admin/users/${masterUserId}] im-core-auth 연동 불가:`, coreAuthError);
        isOffline = true;
      }
    }

    const totalOrdersCount = orders?.length ?? 0;
    const totalSpent = orders?.reduce((sum, o) => o.status !== "cancelled" ? sum + o.total_amount : sum, 0) ?? 0;

    return NextResponse.json({
      success: true,
      user: {
        id: authUser.id,
        email: authUser.email || null,
        phone: authUser.phone || null,
        name: authUser.user_metadata?.name || null,
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at || null,
        points,
        coupons,
        ordersSummary: {
          count: totalOrdersCount,
          spent: totalSpent,
        },
        orders: orders || [],
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

    // Supabase Auth Admin API를 통해 사용자 삭제
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

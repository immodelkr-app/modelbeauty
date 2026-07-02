// ============================================================
// API 라우트: 관리자용 전체 회원 목록 조회
// GET /api/admin/users
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    
    // Supabase Auth Admin API를 통해 프로젝트 전체 가입자 조회
    const { data: { users }, error } = await admin.auth.admin.listUsers();
    
    if (error) throw error;

    // 데이터를 가공하여 필요한 정보만 전송
    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email || null,
      phone: u.phone || null,
      name: u.user_metadata?.name || null,
      masterUserId: u.user_metadata?.master_user_id || u.id,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at || null,
    }));

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

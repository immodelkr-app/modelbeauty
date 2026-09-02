// ============================================================
// PATCH /api/admin/users/[id]/role — 관리자 권한 부여/해제
// ============================================================
// 관리자 권한은 이 프로젝트(모델뷰티) Supabase Auth 계정의
// app_metadata.role === 'admin' 으로 판별한다(auth-admin.ts 참고).
// user_metadata가 아니라 app_metadata인 이유: 본인이 클라이언트에서
// 직접 수정할 수 없고 서비스 롤(이 API)에서만 변경 가능하기 때문.
// [id]는 Supabase Auth userId 또는 masterUserId 어느 쪽이 와도 처리한다
// (GET/DELETE 핸들러와 동일한 방식).

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const isAdmin = body.isAdmin;
    if (typeof isAdmin !== "boolean") {
      return NextResponse.json({ success: false, error: "isAdmin(boolean) 값이 필요합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // ── 대상 회원의 모델뷰티 Supabase Auth 계정 탐색 ─────────────
    let authUser: { id: string; app_metadata?: Record<string, unknown> } | null = null;
    const { data: byIdData } = await admin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } }));
    if (byIdData?.user) {
      authUser = byIdData.user;
    } else {
      const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      authUser = allUsers.find((u) => u.user_metadata?.master_user_id === id) ?? null;
    }

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "이 회원은 모델뷰티 로그인 계정이 없어 관리자 권한을 부여할 수 없습니다. 먼저 모델뷰티에 가입(로그인)해야 합니다." },
        { status: 400 }
      );
    }

    // ── 본인의 관리자 권한은 이 화면에서 해제 불가 (실수로 잠기는 것 방지) ──
    if (!isAdmin) {
      const supabase = await createSupabaseServerClient();
      const { data: { user: me } } = await supabase.auth.getUser();
      if (me && me.id === authUser.id) {
        return NextResponse.json(
          { success: false, error: "본인의 관리자 권한은 이 화면에서 해제할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
      app_metadata: { ...authUser.app_metadata, role: isAdmin ? "admin" : null },
    });
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, isAdmin });
  } catch (error) {
    console.error("[PATCH /api/admin/users/[id]/role] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

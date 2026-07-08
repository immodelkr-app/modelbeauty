import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/create-root
 * 임시 메인 어드민 복구 API
 * 브라우저에서 이 주소를 한번 호출하면 계정이 안전하게 정석대로 생성됩니다.
 */
export async function GET() {
  try {
    const admin = createSupabaseAdmin();

    // 1. 기존 동일 이메일의 유저 검색
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find((u) => u.email === "admin@immodel.kr");
    if (existingUser) {
      // 안전하게 기존 사용자 삭제
      const { error: delError } = await admin.auth.admin.deleteUser(existingUser.id);
      if (delError) console.warn("기존 유저 삭제 중 경고:", delError);
    }

    // 2. Supabase Auth Admin SDK를 사용해 공식 생성 (비밀번호 암호화 완벽 처리)
    const { data: { user }, error: createError } = await admin.auth.admin.createUser({
      email: "admin@immodel.kr",
      password: "kimday@9674",
      email_confirm: true,
      user_metadata: {
        name: "최고관리자",
        role: "admin",
        is_admin: true,
      },
    });

    if (createError || !user) throw createError;

    // 3. user_memberships 초기화
    await admin.from("user_memberships").upsert({
      master_user_id: user.id,
      tier_id: "normal",
      is_locked: true,
      lock_reason: "최고 관리자 계정",
    }, { onConflict: "master_user_id" });

    return NextResponse.json({
      success: true,
      message: "메인 어드민 계정(admin@immodel.kr)이 복구되었습니다. 이제 로그인해보세요!",
      userId: user.id,
    });
  } catch (error) {
    console.error("[GET /api/admin/create-root] 에러:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 에러",
    }, { status: 500 });
  }
}

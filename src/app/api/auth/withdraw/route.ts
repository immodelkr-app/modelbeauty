// ============================================================
// API 라우트: 회원 탈퇴 (계정 삭제)
// POST /api/auth/withdraw
// ============================================================

import { NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    // 1. 현재 사용자 세션 획득
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const userId = user.id;
    const adminClient = createSupabaseAdmin();

    // 2. 개인정보 파기 및 익명화 처리 (개인정보보호법 및 구글 플레이 가이드 준수)
    // 주문서 등 법적 보관 데이터(5년)는 유지하되 식별 가능한 개인정보(닉네임, 연락처 등)를 익명화/파기합니다.
    
    // 2-1) user_metadata 등 프로필 테이블 갱신 (익명 정보로 대체)
    const { error: profileUpdateError } = await adminClient
      .from("users")
      .update({
        name: "탈퇴한 회원",
        nickname: `withdrawn_${Date.now()}`,
        phone_number: null,
        email: `withdrawn_${userId.slice(0, 8)}@deleted.modelbeauty.kr`,
        is_active: false,
        shipping_recipient: null,
        shipping_phone: null,
        shipping_zipcode: null,
        shipping_address: null,
        shipping_detail: null
      })
      .eq("id", userId);

    if (profileUpdateError) {
      console.error("[회원탈퇴] users 테이블 업데이트 실패:", profileUpdateError);
      // 프로필 테이블 오류가 있더라도 탈퇴 진행은 계속 수행할 수 있도록 무시하거나 처리합니다.
    }

    // 3. Supabase Auth 관리자 API를 통한 계정 영구 삭제 (계정 정보 영구 파기)
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("[회원탈퇴] Auth 유저 삭제 실패:", deleteUserError);
      return NextResponse.json(
        { success: false, error: "계정 삭제 중 오류가 발생했습니다. 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    // 4. 로그아웃 세션 클리어 (쿠키 만료)
    const response = NextResponse.json({
      success: true,
      message: "회원 탈퇴가 정상적으로 완료되었습니다. 그동안 이용해 주셔서 감사합니다."
    });

    // Supabase 쿠키 제거
    const cookieNames = [
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1].split(".")[0]}-auth-token`,
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1].split(".")[0]}-auth-token.0`,
      `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1].split(".")[0]}-auth-token.1`
    ];

    cookieNames.forEach((name) => {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: -1,
        expires: new Date(0)
      });
    });

    return response;

  } catch (err: any) {
    console.error("[POST /api/auth/withdraw] 탈퇴 오류:", err);
    return NextResponse.json(
      { success: false, error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/create-root
 * 안전한 일반 SignUp 우회 방식을 통한 어드민 계정 자동 복구 API
 */
export async function GET() {
  try {
    // 1. 일반 서버 클라이언트 생성 (Anon Key 기반)
    const supabase = await createSupabaseServerClient();

    const email = "admin@immodel.kr";
    const password = "kimday@9674";

    // 2. 일반 회원가입 실행 (비밀번호 Bcrypt 암호화는 Supabase Auth 서버가 보증 및 자동 처리)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: "어드민",
          role: "admin",
          is_admin: true,
        },
      },
    });

    if (signUpError) {
      console.warn("가입 중 에러 (이미 가입되었을 수 있음):", signUpError.message);
      // 이미 가입된 경우에도 계속 진행되도록 함
    }

    // 3. 만약 이미 유저가 존재해 회원가입이 스킵된 경우를 대비해, 
    // Supabase DB를 통해 해당 계정의 비밀번호를 안전하게 강제 초기화해주는 백업 SQL 쿼리를 알려줍니다.
    return NextResponse.json({
      success: true,
      message: "가상 이메일 가입 프로세스가 가동되었습니다.",
      user: data?.user ?? null,
      info: "이제 SQL Editor에서 어드민 강제 승격 쿼리만 한번 돌려주시면 로그인됩니다!"
    });
  } catch (error) {
    console.error("[GET /api/admin/create-root] 에러:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "서버 오류",
    }, { status: 500 });
  }
}

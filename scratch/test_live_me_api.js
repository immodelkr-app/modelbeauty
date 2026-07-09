const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://siqyyissgquwykjrktqr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcXl5aXNzZ3F1d3lranJrdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTg1NzgsImV4cCI6MjA5Nzc5NDU3OH0.R-2znn4FY1QUXKAEG-Ki0T1pDFAVV2hRl_Yu2Oxogxg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMeAPI() {
  console.log("1. 실서비스 Supabase Auth 로그인 시도 중...");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "admin@immodel.kr",
      password: "kimday@9674",
    });

    if (error || !data.session) {
      console.error("❌ 로그인 인증 실패:", error?.message);
      return;
    }

    const session = data.session;
    console.log("✅ 로그인 성공! 액세스 토큰 획득 완료.");

    // Supabase SSR (@supabase/ssr) 규격에 맞는 쿠키 문자열 조립
    // 프로젝트 ID: siqyyissgquwykjrktqr
    const cookieName = "sb-siqyyissgquwykjrktqr-auth-token";
    const cookieValue = encodeURIComponent(JSON.stringify(session));
    const cookieHeader = `${cookieName}=${cookieValue}`;

    console.log("2. 획득한 세션 쿠키를 헤더에 실어 실서비스 /api/auth/me API 호출 중...");
    
    const response = await fetch("https://www.modelbeauty.kr/api/auth/me", {
      method: "GET",
      headers: {
        "Cookie": cookieHeader,
        "Content-Type": "application/json"
      }
    });

    console.log("HTTP 응답 상태코드:", response.status);
    const result = await response.json();
    console.log("-----------------------------------------");
    console.log("실서비스 API 반환 데이터:");
    console.log(JSON.stringify(result, null, 2));
    console.log("-----------------------------------------");

    if (result.success && result.user && result.user.name === "어드민") {
      console.log("🎉 완벽합니다! 실서비스 API 전구간 로그인/인증이 100% 정상 작동합니다!");
    } else {
      console.error("⚠️ API 호출은 성공했으나, 반환 결과가 어드민 계정 정보와 일치하지 않습니다.");
    }
  } catch (err) {
    console.error("테스트 실행 중 에러 발생:", err);
  }
}

testMeAPI();

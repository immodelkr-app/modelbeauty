const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://siqyyissgquwykjrktqr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcXl5aXNzZ3F1d3lranJrdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMTg1NzgsImV4cCI6MjA5Nzc5NDU3OH0.R-2znn4FY1QUXKAEG-Ki0T1pDFAVV2hRl_Yu2Oxogxg";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log("Supabase Auth에 로그인 테스트를 시도합니다...");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "admin@immodel.kr",
      password: "kimday@9674",
    });

    if (error) {
      console.error("❌ 로그인 실패! 에러 상세:");
      console.error(JSON.stringify(error, null, 2));
      console.error("에러 메시지:", error.message);
      console.error("에러 상태코드:", error.status);
    } else {
      console.log("✅ 로그인 대성공!");
      console.log("유저 ID:", data.user.id);
      console.log("유저 메타데이터:", data.user.user_metadata);
      console.log("액세스 토큰 세션 획득 성공!");
    }
  } catch (err) {
    console.error("실행 중 예외 오류 발생:", err);
  }
}

testLogin();

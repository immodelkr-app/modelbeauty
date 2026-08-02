// ============================================================
// GET  /api/cron/birthday-coupons — Vercel Cron 전용 (CRON_SECRET 인증)
// POST /api/cron/birthday-coupons — 관리자 수동 실행 (테스트/누락분 처리용)
// ============================================================
// 매일 오늘이 생일인 회원(모델뷰티 로컬 계정에 birth_date가 등록된 경우)에게
// 관리자 설정(system_settings.birthday_coupon_template_id)에 지정된 쿠폰을
// 아임모델 공화국을 통해 자동 발급. 같은 회원에게 연 1회만 발급되도록
// birthday_coupon_issues(master_user_id, year) UNIQUE 제약으로 중복 방지.

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { issueCoupon } from "@/lib/core-auth";

function todayInKST(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

async function runBirthdayCouponJob() {
  const admin = createSupabaseAdmin();

  const { data: settingRow } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "birthday_coupon_template_id")
    .maybeSingle();

  const couponTemplateId = settingRow?.value as string | undefined;
  if (!couponTemplateId) {
    return {
      checked: 0, matched: 0, issued: 0, failed: 0, skipped: 0,
      message: "생일 쿠폰 템플릿이 설정되지 않았습니다. /admin/settings에서 먼저 지정해 주세요.",
    };
  }

  const { year, month, day } = todayInKST();

  let checked = 0, matched = 0, issued = 0, failed = 0, skipped = 0;
  let page = 1;
  const perPage = 200;

  // Supabase Auth 전체 유저를 페이지네이션으로 순회 (모델뷰티 로컬 가입자만 대상 —
  // 생년월일은 im-core-auth가 아니라 이 앱의 user_metadata에만 저장됨)
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users;
    if (users.length === 0) break;

    for (const user of users) {
      checked++;
      const meta = user.user_metadata ?? {};
      const birthDate = meta.birth_date as string | undefined;
      const masterUserId = meta.master_user_id as string | undefined;
      if (!birthDate || !masterUserId) continue;

      // "YYYY-MM-DD" 형식 — UTC 기준으로 파싱해 서버 타임존에 따른 날짜 밀림 방지
      const bd = new Date(birthDate);
      if (Number.isNaN(bd.getTime())) continue;
      if (bd.getUTCMonth() + 1 !== month || bd.getUTCDate() !== day) continue;

      matched++;

      const { data: existing } = await admin
        .from("birthday_coupon_issues")
        .select("id")
        .eq("master_user_id", masterUserId)
        .eq("year", year)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      try {
        await issueCoupon({
          masterUserId,
          couponTemplateId,
          issuedBy: "model_beauty_birthday_cron",
        });
        await admin.from("birthday_coupon_issues").insert({
          master_user_id: masterUserId,
          year,
          coupon_template_id: couponTemplateId,
          status: "issued",
        });
        issued++;
      } catch (err: any) {
        console.error("[birthday-coupons] 쿠폰 발급 실패:", masterUserId, err);
        await admin.from("birthday_coupon_issues").insert({
          master_user_id: masterUserId,
          year,
          coupon_template_id: couponTemplateId,
          status: "failed",
          error_message: err?.message ?? "알 수 없는 오류",
        });
        failed++;
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  return { checked, matched, issued, failed, skipped };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBirthdayCouponJob();
    return Response.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[GET /api/cron/birthday-coupons] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

// 관리자 설정 페이지의 "지금 실행" 버튼 — 테스트 및 누락분 수동 처리용
export async function POST() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const result = await runBirthdayCouponJob();
    return Response.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[POST /api/cron/birthday-coupons] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

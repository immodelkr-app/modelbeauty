// ============================================================
// GET   /api/mypage/profile — 내 프로필(생년월일/성별/마케팅 동의/SNS 활동) 조회
// PATCH /api/mypage/profile — 내 프로필 수정
// ============================================================
// 생년월일/성별/마케팅 동의/SNS 활동 정보는 아임모델 공화국이 아니라 모델뷰티
// 로컬 Supabase Auth user_metadata에만 저장됨 (가입 시 선택 입력, 생일 쿠폰
// 자동발급 및 체험단 신청서 자동 채움에 사용). user_metadata는 통째로
// 덮어써지므로 기존 값과 merge해서 저장 — master_user_id 등 다른 필드가
// 날아가지 않도록 주의.

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const meta = user.user_metadata ?? {};
    return Response.json({
      success: true,
      data: {
        birthDate: meta.birth_date ?? null,
        gender: meta.gender ?? null,
        marketingEmail: meta.marketing_email ?? false,
        marketingSms: meta.marketing_sms ?? false,
        snsYoutube: meta.sns_youtube ?? "",
        snsInstagram: meta.sns_instagram ?? "",
        snsBlogUrl: meta.sns_blog_url ?? "",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/mypage/profile] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { birthDate, gender, marketingEmail, marketingSms, snsYoutube, snsInstagram, snsBlogUrl } = body as {
      birthDate?: string | null;
      gender?: "male" | "female" | "other" | null;
      marketingEmail?: boolean;
      marketingSms?: boolean;
      snsYoutube?: string | null;
      snsInstagram?: string | null;
      snsBlogUrl?: string | null;
    };

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (birthDate) {
      const birth = new Date(birthDate);
      if (Number.isNaN(birth.getTime())) {
        return Response.json({ success: false, error: "생년월일 형식이 올바르지 않습니다." }, { status: 400 });
      }
      const today = new Date();
      const age =
        today.getFullYear() -
        birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
      if (age < 14) {
        return Response.json({ success: false, error: "만 14세 이상만 등록하실 수 있습니다." }, { status: 400 });
      }
    }

    const admin = createSupabaseAdmin();
    const existingMeta = user.user_metadata ?? {};

    const updatedMeta = {
      ...existingMeta,
      ...(birthDate !== undefined ? { birth_date: birthDate || null } : {}),
      ...(gender !== undefined ? { gender: gender || null } : {}),
      ...(marketingEmail !== undefined ? { marketing_email: marketingEmail } : {}),
      ...(marketingSms !== undefined ? { marketing_sms: marketingSms } : {}),
      ...(snsYoutube !== undefined ? { sns_youtube: snsYoutube || null } : {}),
      ...(snsInstagram !== undefined ? { sns_instagram: snsInstagram || null } : {}),
      ...(snsBlogUrl !== undefined ? { sns_blog_url: snsBlogUrl || null } : {}),
    };

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMeta,
    });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("[PATCH /api/mypage/profile] Error:", err);
    return Response.json({ success: false, error: err.message ?? "서버 오류" }, { status: 500 });
  }
}

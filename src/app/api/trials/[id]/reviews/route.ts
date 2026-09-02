// ============================================================
// GET  /api/trials/[id]/reviews — 캠페인 체험 후기 목록 (공개)
// POST /api/trials/[id]/reviews — 체험 후기 작성 (선정된 신청자만)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

// ── GET ──────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("trial_reviews")
      .select("id, campaign_id, trial_application_id, master_user_id, title, body, rating, images, external_link, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return Response.json({
      success: true,
      data: (rows ?? []).map((r) => ({
        id: r.id,
        campaignId: r.campaign_id,
        trialApplicationId: r.trial_application_id,
        masterUserId: r.master_user_id,
        title: r.title,
        body: r.body,
        rating: r.rating,
        images: r.images ?? [],
        externalLink: r.external_link,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("[GET /api/trials/[id]/reviews] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const reviewBody = String(body.body ?? "").trim();
    const rating = Number(body.rating);
    const images = Array.isArray(body.images) ? body.images.slice(0, 10) : [];
    const externalLink = body.externalLink ? String(body.externalLink).trim() : null;

    if (!title || title.length > 100) {
      return Response.json({ success: false, error: "제목을 1~100자로 입력해주세요." }, { status: 400 });
    }
    if (!reviewBody || reviewBody.length > 4000) {
      return Response.json({ success: false, error: "본문을 1~4000자로 입력해주세요." }, { status: 400 });
    }
    const ALLOWED_RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    if (!ALLOWED_RATINGS.includes(rating)) {
      return Response.json({ success: false, error: "총점 별점을 0.5점 단위로 1~5점 사이에서 선택해주세요." }, { status: 400 });
    }
    if (!images.every((img: unknown) => typeof img === "string" && /^https?:\/\//.test(img))) {
      return Response.json({ success: false, error: "이미지 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (externalLink && !/^https?:\/\//.test(externalLink)) {
      return Response.json({ success: false, error: "SNS 링크는 http(s):// 로 시작해야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: application, error: appError } = await admin
      .from("trial_applications")
      .select("id, status")
      .eq("campaign_id", campaignId)
      .eq("master_user_id", masterUserId)
      .single();

    if (appError || !application || application.status !== "selected") {
      return Response.json(
        { success: false, error: "선정된 체험단만 후기를 작성할 수 있습니다." },
        { status: 403 }
      );
    }

    const { data: review, error: insertError } = await admin
      .from("trial_reviews")
      .insert({
        campaign_id: campaignId,
        trial_application_id: application.id,
        master_user_id: masterUserId,
        title,
        body: reviewBody,
        rating,
        images: images.map((url: string) => ({ url })),
        external_link: externalLink,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json({ success: false, error: "이미 이 체험단 후기를 작성하셨습니다." }, { status: 409 });
      }
      throw insertError;
    }

    return Response.json({ success: true, data: review }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/trials/[id]/reviews] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

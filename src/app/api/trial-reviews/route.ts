// ============================================================
// GET /api/trial-reviews — 전체 체험 후기 최신순 (메인페이지 노출용, 공개)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 8, 24);

    const supabase = await createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from("trial_reviews")
      .select(
        `id, campaign_id, trial_application_id, master_user_id, title, body, images, external_link, created_at,
         trial_campaigns ( id, title, product_id, products ( id, name, slug ) )`
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const data = (rows ?? []).map((r) => {
      const campaignRaw = Array.isArray(r.trial_campaigns) ? r.trial_campaigns[0] : r.trial_campaigns;
      const productRaw = campaignRaw
        ? (Array.isArray(campaignRaw.products) ? campaignRaw.products[0] : campaignRaw.products)
        : null;
      return {
        id: r.id,
        campaignId: r.campaign_id,
        trialApplicationId: r.trial_application_id,
        masterUserId: r.master_user_id,
        title: r.title,
        body: r.body,
        images: r.images ?? [],
        externalLink: r.external_link,
        createdAt: r.created_at,
        campaign: campaignRaw ? { id: campaignRaw.id, title: campaignRaw.title } : undefined,
        product: productRaw ? { id: productRaw.id, name: productRaw.name, slug: productRaw.slug } : undefined,
      };
    });

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[GET /api/trial-reviews] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

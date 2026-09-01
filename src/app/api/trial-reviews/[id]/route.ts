// ============================================================
// GET /api/trial-reviews/[id] — 체험 후기 단건 조회 (블로그 상세, 공개)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: r, error } = await supabase
      .from("trial_reviews")
      .select(
        `id, campaign_id, trial_application_id, master_user_id, title, body, images, external_link, created_at,
         trial_campaigns ( id, title, product_id, products ( id, name, slug, images, base_price, sale_price ) )`
      )
      .eq("id", id)
      .single();

    if (error || !r) {
      return Response.json({ success: false, error: "체험 후기를 찾을 수 없습니다." }, { status: 404 });
    }

    const campaignRaw = Array.isArray(r.trial_campaigns) ? r.trial_campaigns[0] : r.trial_campaigns;
    const productRaw = campaignRaw
      ? (Array.isArray(campaignRaw.products) ? campaignRaw.products[0] : campaignRaw.products)
      : null;

    return Response.json({
      success: true,
      data: {
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
        product: productRaw
          ? {
              id: productRaw.id,
              name: productRaw.name,
              slug: productRaw.slug,
              images: productRaw.images ?? [],
              basePrice: productRaw.base_price,
              salePrice: productRaw.sale_price,
            }
          : undefined,
      },
    });
  } catch (err) {
    console.error("[GET /api/trial-reviews/[id]] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ============================================================
// GET /api/trials/[id] — 체험단 캠페인 상세 (공개)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: campaign, error } = await supabase
      .from("trial_campaigns")
      .select(
        `id, product_id, vendor_id, title, description, content, campaign_type, price,
         quota, recruit_start, recruit_end, status, created_at, updated_at,
         products ( id, name, slug, images, base_price, sale_price )`
      )
      .eq("id", id)
      .single();

    if (error || !campaign) {
      return Response.json({ success: false, error: "체험단을 찾을 수 없습니다." }, { status: 404 });
    }

    const { count } = await supabase
      .from("trial_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id);

    const { data: { user } } = await supabase.auth.getUser();
    let alreadyApplied = false;
    if (user) {
      const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
      const { data: mine } = await supabase
        .from("trial_applications")
        .select("id")
        .eq("campaign_id", id)
        .eq("master_user_id", masterUserId)
        .maybeSingle();
      alreadyApplied = !!mine;
    }

    const productRaw = Array.isArray(campaign.products) ? campaign.products[0] : campaign.products;

    return Response.json({
      success: true,
      data: {
        id: campaign.id,
        productId: campaign.product_id,
        vendorId: campaign.vendor_id,
        title: campaign.title,
        description: campaign.description,
        content: campaign.content,
        campaignType: campaign.campaign_type,
        price: campaign.price,
        quota: campaign.quota,
        recruitStart: campaign.recruit_start,
        recruitEnd: campaign.recruit_end,
        status: campaign.status,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
        product: productRaw
          ? {
              id: productRaw.id,
              name: productRaw.name,
              slug: productRaw.slug,
              images: productRaw.images ?? [],
              basePrice: productRaw.base_price,
              salePrice: productRaw.sale_price,
            }
          : null,
        applicantCount: count ?? 0,
      },
      alreadyApplied,
    });
  } catch (err) {
    console.error("[GET /api/trials/[id]] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

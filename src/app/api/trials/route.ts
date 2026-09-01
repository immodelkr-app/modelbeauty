// ============================================================
// GET /api/trials — 진행중인 체험단 캠페인 목록 (공개)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: campaigns, error } = await supabase
      .from("trial_campaigns")
      .select(
        `id, product_id, vendor_id, title, description, campaign_type, price,
         quota, recruit_start, recruit_end, status, created_at, updated_at,
         products ( id, name, slug, images, base_price, sale_price )`
      )
      .in("status", ["recruiting", "selecting"])
      .order("recruit_end", { ascending: true });

    if (error) throw error;

    const campaignIds = (campaigns ?? []).map((c) => c.id);
    const { data: applications } = campaignIds.length
      ? await supabase
          .from("trial_applications")
          .select("campaign_id")
          .in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string }[] };

    const countByCampaign = new Map<string, number>();
    for (const a of applications ?? []) {
      countByCampaign.set(a.campaign_id, (countByCampaign.get(a.campaign_id) ?? 0) + 1);
    }

    // 로그인 상태라면 내가 이미 신청한 캠페인 id 목록도 함께 내려준다.
    const { data: { user } } = await supabase.auth.getUser();
    let myApplications: string[] = [];
    if (user) {
      const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
      const { data: mine } = await supabase
        .from("trial_applications")
        .select("campaign_id")
        .eq("master_user_id", masterUserId)
        .in("campaign_id", campaignIds);
      myApplications = (mine ?? []).map((m) => m.campaign_id);
    }

    const data = (campaigns ?? []).map((c) => {
      const productRaw = Array.isArray(c.products) ? c.products[0] : c.products;
      return {
        id: c.id,
        productId: c.product_id,
        vendorId: c.vendor_id,
        title: c.title,
        description: c.description,
        campaignType: c.campaign_type,
        price: c.price,
        quota: c.quota,
        recruitStart: c.recruit_start,
        recruitEnd: c.recruit_end,
        status: c.status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
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
        applicantCount: countByCampaign.get(c.id) ?? 0,
      };
    });

    return Response.json({ success: true, data, myApplications });
  } catch (err) {
    console.error("[GET /api/trials] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

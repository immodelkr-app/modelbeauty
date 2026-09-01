// ============================================================
// GET /trials — 체험단 모집 전용 페이지 (Server Component)
// ============================================================

import type { Metadata } from "next";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import TrialsGrid from "@/components/trials/TrialsGrid";
import type { TrialCampaign } from "@/types";

export const metadata: Metadata = {
  title: "체험단 모집 | 모델뷰티",
  description: "모델뷰티 제품을 무료 또는 참가비로 체험하고 리뷰를 남겨보세요.",
};

async function getCampaigns(): Promise<{ campaigns: TrialCampaign[]; myApplications: string[] }> {
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

  if (error) {
    console.error("[getCampaigns] error:", error);
    return { campaigns: [], myApplications: [] };
  }

  // trial_applications는 RLS가 서비스 롤 전용(공개 정책 없음)이라 admin 클라이언트로 조회한다.
  const admin = createSupabaseAdmin();

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: applications } = campaignIds.length
    ? await admin.from("trial_applications").select("campaign_id").in("campaign_id", campaignIds)
    : { data: [] as { campaign_id: string }[] };

  const countByCampaign = new Map<string, number>();
  for (const a of applications ?? []) {
    countByCampaign.set(a.campaign_id, (countByCampaign.get(a.campaign_id) ?? 0) + 1);
  }

  const { data: { user } } = await supabase.auth.getUser();
  let myApplications: string[] = [];
  if (user) {
    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const { data: mine } = await admin
      .from("trial_applications")
      .select("campaign_id")
      .eq("master_user_id", masterUserId)
      .in("campaign_id", campaignIds);
    myApplications = (mine ?? []).map((m) => m.campaign_id);
  }

  const mapped: TrialCampaign[] = (campaigns ?? [])
    .map((c) => {
      const productRaw = Array.isArray(c.products) ? c.products[0] : c.products;
      if (!productRaw) return null;
      return {
        id: c.id,
        productId: c.product_id,
        vendorId: c.vendor_id,
        title: c.title,
        description: c.description,
        campaignType: c.campaign_type as "free" | "paid",
        price: c.price,
        quota: c.quota,
        recruitStart: c.recruit_start,
        recruitEnd: c.recruit_end,
        status: c.status as TrialCampaign["status"],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        product: {
          id: productRaw.id,
          name: productRaw.name,
          slug: productRaw.slug,
          images: (productRaw.images as { url: string }[]) ?? [],
          basePrice: productRaw.base_price,
          salePrice: productRaw.sale_price,
        },
        applicantCount: countByCampaign.get(c.id) ?? 0,
      };
    })
    .filter((c): c is TrialCampaign => c !== null);

  return { campaigns: mapped, myApplications };
}

export default async function TrialsPage() {
  const { campaigns, myApplications } = await getCampaigns();

  return (
    <div style={{ minHeight: "70vh", paddingBottom: "4rem" }}>
      <section
        style={{
          background: "linear-gradient(135deg, var(--mb-pink-50), #fff)",
          padding: "3rem 1.5rem",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--mb-pink-600)",
            background: "#fff",
            padding: "0.35rem 0.9rem",
            borderRadius: "999px",
            marginBottom: "0.9rem",
          }}
        >
          🎁 MODEL BEAUTY 체험단
        </span>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.6rem", color: "var(--mb-gray-900)" }}>
          제품을 먼저 만나보고 후기를 남겨주세요
        </h1>
        <p style={{ color: "var(--mb-gray-500)", margin: 0 }}>
          무료 체험단부터 소정의 참가비로 진행하는 체험단까지, 지금 모집 중인 캠페인을 확인해보세요.
        </p>
      </section>

      <div className="shop-container" style={{ marginTop: "2.5rem" }}>
        <TrialsGrid campaigns={campaigns} initialMyApplications={myApplications} />
      </div>
    </div>
  );
}

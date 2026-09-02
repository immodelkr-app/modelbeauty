// ============================================================
// GET /trials/[id] — 체험단 상세 페이지 (Server Component)
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";
import TrialApplyPanel from "@/components/trials/TrialApplyPanel";
import TrialReviews from "@/components/trials/TrialReviews";
import type { TrialCampaign, TrialReview } from "@/types";

async function getCampaign(id: string): Promise<{
  campaign: TrialCampaign;
  alreadyApplied: boolean;
  canWriteReview: boolean;
  reviews: TrialReview[];
} | null> {
  const supabase = await createSupabaseServerClient();

  const { data: campaign, error } = await supabase
    .from("trial_campaigns")
    .select(
      `id, product_id, vendor_id, title, description, content, thumbnail, campaign_type, price,
       quota, recruit_start, recruit_end, status, created_at, updated_at,
       products ( id, name, slug, images, base_price, sale_price )`
    )
    .eq("id", id)
    .single();

  if (error || !campaign) return null;

  // trial_applications는 RLS가 서비스 롤 전용(공개 정책 없음)이라 admin 클라이언트로 조회한다.
  const admin = createSupabaseAdmin();

  const { count } = await admin
    .from("trial_applications")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);

  const { data: reviewRows } = await supabase
    .from("trial_reviews")
    .select("id, campaign_id, trial_application_id, master_user_id, title, body, rating, images, external_link, created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  const reviews: TrialReview[] = (reviewRows ?? []).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    trialApplicationId: r.trial_application_id,
    masterUserId: r.master_user_id,
    title: r.title,
    body: r.body,
    rating: r.rating,
    images: (r.images as { url: string }[]) ?? [],
    externalLink: r.external_link,
    isHidden: false,
    hiddenReason: null,
    createdAt: r.created_at,
    updatedAt: r.created_at,
  }));

  const { data: { user } } = await supabase.auth.getUser();
  let alreadyApplied = false;
  let canWriteReview = false;
  if (user) {
    const masterUserId = (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
    const { data: mine } = await admin
      .from("trial_applications")
      .select("id, status")
      .eq("campaign_id", id)
      .eq("master_user_id", masterUserId)
      .maybeSingle();
    alreadyApplied = !!mine;
    if (mine?.status === "selected") {
      // 공개 목록(reviews)은 RLS로 is_hidden 후기가 걸러지므로, 숨김 처리된 후기까지
      // 포함해 이미 작성했는지 판단하려면 관리자 클라이언트로 별도 확인해야 한다.
      const { data: existingReview } = await admin
        .from("trial_reviews")
        .select("id")
        .eq("trial_application_id", mine.id)
        .maybeSingle();
      canWriteReview = !existingReview;
    }
  }

  const productRaw = Array.isArray(campaign.products) ? campaign.products[0] : campaign.products;

  return {
    canWriteReview,
    reviews,
    campaign: {
      id: campaign.id,
      productId: campaign.product_id,
      vendorId: campaign.vendor_id,
      title: campaign.title,
      description: campaign.description,
      content: campaign.content,
      thumbnail: campaign.thumbnail,
      campaignType: campaign.campaign_type as "free" | "paid",
      price: campaign.price,
      quota: campaign.quota,
      recruitStart: campaign.recruit_start,
      recruitEnd: campaign.recruit_end,
      status: campaign.status as TrialCampaign["status"],
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      product: productRaw
        ? {
            id: productRaw.id,
            name: productRaw.name,
            slug: productRaw.slug,
            images: (productRaw.images as { url: string }[]) ?? [],
            basePrice: productRaw.base_price,
            salePrice: productRaw.sale_price,
          }
        : null,
      applicantCount: count ?? 0,
    },
    alreadyApplied,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getCampaign(id);
  if (!result) return { title: "체험단을 찾을 수 없습니다" };
  return {
    title: `${result.campaign.title} | 모델뷰티 체험단`,
    description: result.campaign.description ?? (result.campaign.product ? `${result.campaign.product.name} 체험단 모집` : `${result.campaign.title} 체험단 모집`),
  };
}

function formatDday(recruitEnd: string): string {
  const diffDays = Math.ceil((new Date(recruitEnd).getTime() - Date.now()) / 86400000);
  if (diffDays < 0) return "마감";
  if (diffDays === 0) return "오늘 마감";
  return `D-${diffDays}`;
}

export default async function TrialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCampaign(id);
  if (!result) notFound();

  const { campaign, alreadyApplied, canWriteReview, reviews } = result;
  const thumbnail = campaign.thumbnail ?? campaign.product?.images?.[0]?.url ?? null;
  const dday = formatDday(campaign.recruitEnd);
  const isClosed = campaign.status !== "recruiting" || dday === "마감";

  return (
    <div className="shop-container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 720 }}>
      <nav style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", marginBottom: "1.25rem" }}>
        <Link href="/trials" style={{ color: "inherit" }}>체험단</Link>
        <span style={{ margin: "0 0.4rem" }}>/</span>
        <span style={{ color: "var(--mb-gray-900)" }}>{campaign.title}</span>
      </nav>

      <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", borderRadius: "20px", overflow: "hidden", background: "var(--mb-gray-50)" }}>
        {thumbnail ? (
          <Image src={thumbnail} alt={campaign.product?.name ?? campaign.title} fill sizes="(max-width: 768px) 100vw, 720px" style={{ objectFit: "cover" }} priority />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "3rem" }}>✨</div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0 0.75rem" }}>
        <span
          style={{
            fontSize: "0.75rem", fontWeight: 800, padding: "0.3rem 0.7rem", borderRadius: "999px",
            background: campaign.campaignType === "free" ? "var(--mb-pink-50)" : "#191919",
            color: campaign.campaignType === "free" ? "var(--mb-pink-600)" : "#fff",
          }}
        >
          {campaign.campaignType === "free" ? "무료 체험단" : `참가비 ${campaign.price.toLocaleString()}원`}
        </span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.3rem 0.7rem", borderRadius: "999px", background: "var(--mb-gray-100)", color: "var(--mb-gray-600)" }}>
          {dday}
        </span>
      </div>

      {campaign.product && (
        <Link href={`/products/${campaign.product.slug}`} style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", textDecoration: "underline" }}>
          {campaign.product.name} 상품 보기 →
        </Link>
      )}

      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0.75rem", color: "var(--mb-gray-900)" }}>
        {campaign.title}
      </h1>

      {campaign.description && (
        <p style={{ fontSize: "0.9375rem", color: "var(--mb-gray-700, #374151)", lineHeight: 1.7, margin: "0 0 1.25rem" }}>
          {campaign.description}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          padding: "1rem 1.25rem",
          background: "var(--mb-gray-50)",
          borderRadius: "14px",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "var(--mb-gray-500)" }}>모집 기간</p>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>
            {new Date(campaign.recruitStart).toLocaleDateString("ko-KR")} ~ {new Date(campaign.recruitEnd).toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div>
          <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "var(--mb-gray-500)" }}>정원 / 신청</p>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>{campaign.quota}명 / {campaign.applicantCount}명</p>
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <TrialApplyPanel campaignId={campaign.id} isClosed={isClosed} initialApplied={alreadyApplied} />
      </div>

      {campaign.content && (
        <div
          className="product-detail-html"
          style={{ borderTop: "1px solid var(--mb-gray-200)", paddingTop: "1.5rem" }}
          dangerouslySetInnerHTML={{ __html: campaign.content }}
        />
      )}

      <TrialReviews campaignId={campaign.id} initialReviews={reviews} canWrite={canWriteReview} />
    </div>
  );
}

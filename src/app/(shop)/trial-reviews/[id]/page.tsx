// ============================================================
// GET /trial-reviews/[id] — 체험 후기 블로그 상세 페이지 (Server Component)
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StarRatingDisplay } from "@/components/trials/StarRating";

interface TrialReviewDetail {
  id: string;
  title: string;
  body: string;
  rating: number;
  images: { url: string }[];
  externalLink: string | null;
  createdAt: string;
  campaign: { id: string; title: string } | null;
  product: { id: string; name: string; slug: string; images: { url: string }[]; basePrice: number; salePrice: number | null } | null;
}

async function getReview(id: string): Promise<TrialReviewDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: r, error } = await supabase
    .from("trial_reviews")
    .select(
      `id, title, body, rating, images, external_link, created_at,
       trial_campaigns ( id, title, product_id, products ( id, name, slug, images, base_price, sale_price ) )`
    )
    .eq("id", id)
    .single();

  if (error || !r) return null;

  const campaignRaw = Array.isArray(r.trial_campaigns) ? r.trial_campaigns[0] : r.trial_campaigns;
  const productRaw = campaignRaw
    ? (Array.isArray(campaignRaw.products) ? campaignRaw.products[0] : campaignRaw.products)
    : null;

  return {
    id: r.id,
    title: r.title,
    body: r.body,
    rating: r.rating,
    images: (r.images as { url: string }[]) ?? [],
    externalLink: r.external_link,
    createdAt: r.created_at,
    campaign: campaignRaw ? { id: campaignRaw.id, title: campaignRaw.title } : null,
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
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) return { title: "체험 후기를 찾을 수 없습니다" };
  return {
    title: `${review.title} | 모델뷰티 체험 후기`,
    description: review.body.slice(0, 120),
  };
}

export default async function TrialReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) notFound();

  const displayPrice = review.product ? (review.product.salePrice ?? review.product.basePrice) : null;

  return (
    <div className="shop-container" style={{ paddingTop: "2rem", paddingBottom: "5rem", maxWidth: 680 }}>
      <nav style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", marginBottom: "1.25rem" }}>
        <Link href="/trials" style={{ color: "inherit" }}>체험단</Link>
        {review.campaign && (
          <>
            <span style={{ margin: "0 0.4rem" }}>/</span>
            <Link href={`/trials/${review.campaign.id}`} style={{ color: "inherit" }}>{review.campaign.title}</Link>
          </>
        )}
        <span style={{ margin: "0 0.4rem" }}>/</span>
        <span style={{ color: "var(--mb-gray-900)" }}>체험 후기</span>
      </nav>

      <span
        style={{
          display: "inline-block", fontSize: "0.72rem", fontWeight: 800,
          padding: "0.25rem 0.65rem", borderRadius: "999px",
          background: "var(--mb-pink-50)", color: "var(--mb-pink-600)", marginBottom: "0.75rem",
        }}
      >
        🎁 체험 후기
      </span>

      <h1 style={{ fontSize: "1.625rem", fontWeight: 800, margin: "0 0 0.5rem", lineHeight: 1.35, color: "var(--mb-gray-900)" }}>
        {review.title}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "0 0 1.75rem" }}>
        <StarRatingDisplay rating={review.rating} size={17} />
        <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-400)" }}>
          {new Date(review.createdAt).toLocaleDateString("ko-KR")}
        </span>
      </div>

      {review.product && (
        <Link
          href={`/products/${review.product.slug}`}
          style={{
            display: "flex", alignItems: "center", gap: "1rem",
            border: "1px solid var(--mb-gray-200)", borderRadius: "16px", padding: "0.9rem 1.1rem",
            marginBottom: "2rem", textDecoration: "none", color: "inherit",
          }}
        >
          <div style={{ position: "relative", width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--mb-gray-50)" }}>
            {review.product.images?.[0]?.url && (
              <img src={review.product.images[0].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 0.15rem", fontSize: "0.72rem", color: "var(--mb-gray-500)" }}>이 후기의 체험 제품</p>
            <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {review.product.name}
            </p>
            {displayPrice !== null && (
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.875rem", fontWeight: 800, color: "var(--mb-pink-600)" }}>
                {displayPrice.toLocaleString()}원
              </p>
            )}
          </div>
          <span
            style={{
              flexShrink: 0, padding: "0.55rem 1rem", borderRadius: "999px",
              background: "var(--mb-pink-600)", color: "#fff", fontSize: "0.8125rem", fontWeight: 700,
            }}
          >
            구매하러 가기
          </span>
        </Link>
      )}

      <div style={{ fontSize: "1rem", lineHeight: 1.85, color: "var(--mb-gray-800, #1f2937)", whiteSpace: "pre-wrap" }}>
        {review.body}
      </div>

      {review.images.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" }}>
          {review.images.map((img, i) => (
            <img key={i} src={img.url} alt="" style={{ width: "100%", borderRadius: "12px", display: "block" }} />
          ))}
        </div>
      )}

      {review.externalLink && (
        <a
          href={review.externalLink}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", marginTop: "1.5rem", fontSize: "0.875rem", color: "var(--mb-pink-600)", fontWeight: 700 }}
        >
          🔗 작성자의 SNS 포스팅 원문 보기
        </a>
      )}

      {review.product && (
        <Link
          href={`/products/${review.product.slug}`}
          style={{
            display: "block", textAlign: "center", marginTop: "3rem", padding: "1rem",
            background: "var(--mb-pink-600)", color: "#fff", borderRadius: "12px",
            fontSize: "1rem", fontWeight: 800, textDecoration: "none",
          }}
        >
          {review.product.name} 구매하러 가기 →
        </Link>
      )}
    </div>
  );
}

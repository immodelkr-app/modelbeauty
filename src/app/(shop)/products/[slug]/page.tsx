// ============================================================
// GET /products/[slug] — 상품 상세 페이지 (Server Component)
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductGallery from "@/components/products/ProductGallery";
import ProductOptions from "@/components/products/ProductOptions";
import ProductCard from "@/components/products/ProductCard";
import ProductDetailTabs from "@/components/products/ProductDetailTabs";
import CrewRecommendBanner from "@/components/products/CrewRecommendBanner";
import ShareButtons from "@/components/products/ShareButtons";
import type { Product, ProductOption, ProductVariant, ProductVideo } from "@/types";

const APP_URL = "https://www.modelbeauty.kr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("name, description, images, categories(name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!data) return { title: "상품을 찾을 수 없습니다" };

  const title = `${data.name}`;
  const description = data.description ?? `모델뷰티의 ${data.name}`;
  const productUrl = `${APP_URL}/products/${slug}`;
  const images = (data.images as { url: string }[] | null) ?? [];
  const ogImage = images[0]?.url ?? `${APP_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: { canonical: productUrl },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: productUrl,
      siteName: "모델뷰티",
      title: `${title} | 모델뷰티`,
      description,
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | 모델뷰티`,
      description,
      images: [ogImage],
    },
  };
}

// ── 데이터 패칭 ─────────────────────────────────────────

// ── getProduct 확장 타입 ─────────────────────────────────
type ProductWithCrew = Product & {
  recommenderCrew?: { id: string; name: string; nickname: string } | null;
  recommendationNote?: string | null;
};

async function getProduct(slug: string): Promise<ProductWithCrew | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, description, content, base_price, sale_price,
       stock_quantity, sku, images, tags, is_active, is_featured,
       created_at, updated_at, category_id,
       categories ( id, name, slug, parent_id ),
       recommender_crew_id, recommendation_note,
       live_crews ( id, name, nickname )`
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  const cat = Array.isArray(data.categories)
    ? data.categories[0]
    : data.categories;

  const crewRaw = Array.isArray(data.live_crews)
    ? data.live_crews[0]
    : data.live_crews;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    content: data.content,
    basePrice: data.base_price,
    salePrice: data.sale_price,
    stockQuantity: data.stock_quantity,
    sku: data.sku,
    images: (data.images as Product["images"]) ?? [],
    tags: data.tags ?? [],
    isActive: data.is_active,
    isFeatured: data.is_featured,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    categoryId: data.category_id,
    category: cat
      ? { id: cat.id, name: cat.name, slug: cat.slug, parentId: cat.parent_id, sortOrder: 0, imageUrl: null, isActive: true, createdAt: "" }
      : undefined,
    recommenderCrew: crewRaw
      ? { id: crewRaw.id, name: crewRaw.name, nickname: crewRaw.nickname }
      : null,
    recommendationNote: data.recommendation_note ?? null,
  };
}

async function getProductOptions(productId: string): Promise<{
  options: ProductOption[];
  variants: ProductVariant[];
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: optData }, { data: varData }] = await Promise.all([
    supabase
      .from("product_options")
      .select("id, name, values, sort_order")
      .eq("product_id", productId)
      .order("sort_order"),
    supabase
      .from("product_variants")
      .select("id, option_values, sku, price_adjustment, stock_quantity, is_active, created_at")
      .eq("product_id", productId)
      .eq("is_active", true),
  ]);

  const options: ProductOption[] = (optData ?? []).map((o) => ({
    id: o.id,
    productId,
    name: o.name,
    values: o.values as string[],
    sortOrder: o.sort_order,
  }));

  const variants: ProductVariant[] = (varData ?? []).map((v) => ({
    id: v.id,
    productId,
    optionValues: v.option_values as Record<string, string>,
    sku: v.sku,
    priceAdjustment: v.price_adjustment,
    stockQuantity: v.stock_quantity,
    isActive: v.is_active,
    createdAt: v.created_at,
  }));

  return { options, variants };
}

async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string
): Promise<Product[]> {
  if (!categoryId) return [];

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select(
      `id, name, slug, description, base_price, sale_price,
       stock_quantity, sku, images, tags, is_active, is_featured,
       created_at, updated_at, category_id,
       categories ( id, name, slug )`
    )
    .eq("is_active", true)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .order("created_at", { ascending: false })
    .limit(4);

  return (data ?? []).map((p) => {
    const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      content: null,
      basePrice: p.base_price,
      salePrice: p.sale_price,
      stockQuantity: p.stock_quantity,
      sku: p.sku,
      images: (p.images as Product["images"]) ?? [],
      tags: p.tags ?? [],
      isActive: p.is_active,
      isFeatured: p.is_featured,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      categoryId: p.category_id,
      category: cat ? { id: cat.id, name: cat.name, slug: cat.slug, parentId: null, sortOrder: 0, imageUrl: null, isActive: true, createdAt: "" } : undefined,
    } satisfies Product;
  });
}

// ── 유틸리티 ─────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원";
}

function calcDiscountRate(base: number, sale: number): number {
  return Math.round(((base - sale) / base) * 100);
}

async function getProductVideos(productId: string): Promise<ProductVideo[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_videos")
    .select("*")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((v) => ({
    id: v.id,
    productId: v.product_id,
    streamId: v.stream_id,
    title: v.title,
    videoUrl: v.video_url,
    thumbnailUrl: v.thumbnail_url,
    sourceType: v.source_type,
    durationSec: v.duration_sec,
    sortOrder: v.sort_order,
    isActive: v.is_active,
    createdAt: v.created_at,
  }));
}

// ── 페이지 컴포넌트 ───────────────────────────────────────

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ stream_id?: string }>;
}) {
  const { slug } = await params;
  const { stream_id } = await searchParams;

  const product = await getProduct(slug);
  if (!product) notFound();

  const [{ options, variants }, videos, relatedProducts] = await Promise.all([
    getProductOptions(product.id),
    getProductVideos(product.id),
    getRelatedProducts(product.categoryId ?? null, product.id),
  ]);

  const displayPrice = product.salePrice ?? product.basePrice;
  const hasDiscount =
    product.salePrice !== null && product.salePrice < product.basePrice;
  const discountRate = hasDiscount
    ? calcDiscountRate(product.basePrice, product.salePrice!)
    : 0;

  // ── JSON-LD 구조화 데이터 (schema.org/Product) ───────────
  const images = product.images ?? [];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? `모델뷰티의 ${product.name}`,
    image: images.map((img: { url: string }) => img.url),
    url: `${APP_URL}/products/${product.slug}`,
    brand: {
      "@type": "Brand",
      name: "모델뷰티",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "KRW",
      price: displayPrice,
      availability:
        product.stockQuantity > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "모델뷰티",
      },
      url: `${APP_URL}/products/${product.slug}`,
    },
    ...(hasDiscount && {
      // 할인가격이 있을 때만 추가
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "KRW",
        lowPrice: displayPrice,
        highPrice: product.basePrice,
        offerCount: 1,
      },
    }),
  };

  return (
    <>
      {/* JSON-LD 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {stream_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `sessionStorage.setItem("last_live_stream_id", ${JSON.stringify(stream_id)});`
          }}
        />
      )}
      <div className="product-detail">
        {/* 브레드크럼 */}
        <nav className="product-detail-breadcrumb" aria-label="페이지 위치">
          <Link href="/">홈</Link>
          <span className="product-detail-breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/products">전체 상품</Link>
          {product.category && (
            <>
              <span className="product-detail-breadcrumb-sep" aria-hidden="true">/</span>
              <Link href={`/products?category=${product.category.slug}`}>
                {product.category.name}
              </Link>
            </>
          )}
          <span className="product-detail-breadcrumb-sep" aria-hidden="true">/</span>
          <span className="product-detail-breadcrumb-current">{product.name}</span>
        </nav>

        <div className="product-detail-grid">
          {/* 이미지 갤러리 (Client Component) */}
          <ProductGallery images={product.images} productName={product.name} />

          {/* 상품 정보 */}
          <div className="product-info">
            {product.category && (
              <p className="product-info-category">{product.category.name}</p>
            )}

            <h1 className="product-info-name">{product.name}</h1>

            {/* 가격 */}
            <div className="product-info-price-wrap">
              <span className="product-info-price">{formatPrice(displayPrice)}</span>
              {hasDiscount && (
                <>
                  <span className="product-info-price-original">
                    {formatPrice(product.basePrice)}
                  </span>
                  <span className="product-info-discount-badge">
                    {discountRate}% 할인
                  </span>
                </>
              )}
            </div>

            <div className="product-info-divider" role="separator" />

            {/* 간단 설명 */}
            {product.description && (
              <p className="product-info-desc">{product.description}</p>
            )}

            {/* 옵션 + 수량 + CTA (Client Component) */}
            <ProductOptions
              productId={product.id}
              options={options}
              variants={variants}
              basePrice={product.basePrice}
              salePrice={product.salePrice}
              stockQuantity={product.stockQuantity}
            />

            {/* 크루 추천 배너 */}
            {product.recommenderCrew && (
              <CrewRecommendBanner
                crewNickname={product.recommenderCrew.nickname}
                crewName={product.recommenderCrew.name}
                note={product.recommendationNote}
              />
            )}

            {/* 공유 버튼 */}
            <ShareButtons
              productName={product.name}
              productUrl={`${APP_URL}/products/${product.slug}`}
              thumbnailUrl={(product.images?.[0] as { url: string } | undefined)?.url}
              description={product.description}
              crewNickname={product.recommenderCrew?.nickname}
              recommendationNote={product.recommendationNote}
            />

            {/* 태그 */}
            {product.tags.length > 0 && (
              <div>
                <div className="product-info-divider" role="separator" />
                <div className="product-tags" style={{ marginTop: "1rem" }}>
                  {product.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/products?tag=${tag}`}
                      className="product-tag"
                    >
                      # {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 배송/혜택 안내 */}
            <div
              style={{
                padding: "1.25rem",
                background: "var(--mb-gray-50)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "0.625rem",
              }}
            >
              {[
                { icon: "🚚", text: "50,000원 이상 구매 시 무료배송" },
                { icon: "✨", text: "구매 시 포인트 1% 적립" },
              ].map((item) => (
                <div
                  key={item.text}
                  style={{ display: "flex", gap: "0.625rem", fontSize: "0.875rem", color: "var(--mb-gray-600)" }}
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* 배송/환불·반품/고객문의 안내 (고정 노출) */}
            <div
              style={{
                marginTop: "0.75rem",
                padding: "1.25rem",
                background: "#fff",
                border: "1px solid var(--mb-gray-200)",
                borderRadius: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.625rem" }}>
                <span>📦</span>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 700, color: "var(--mb-gray-900)" }}>
                    배송 안내
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--mb-gray-600)", lineHeight: 1.6 }}>
                    결제 완료 후 안내된 일정에 따라 배송되며 영업일 기준 1일~3일 이내 발송이 됩니다.
                    <br />
                    최대 14일 이내 배송이 완료됩니다.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.625rem" }}>
                <span>🔄</span>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 700, color: "var(--mb-gray-900)" }}>
                    환불/반품 안내
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "var(--mb-gray-600)", lineHeight: 1.6 }}>
                    <li>배송 시작 전 : 결제 금액 100% 환불</li>
                    <li>배송 시작 후 : 배송비를 제외한 금액 환불</li>
                    <li>상품 수령 후 7일 이내 (단순 변심) : 고객센터로 사전 연락 후 교환/반품 가능</li>
                    <li>교환/반품/환불 시 : 배송비는 고객부담으로 진행됨</li>
                  </ul>
                  <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "var(--mb-gray-500)" }}>
                    ※ 상품 수령 후 7일이 경과하면 환불 및 반품이 제한될 수 있습니다. 단, 상품 하자 또는 오배송의 경우 왕복 배송비는 당사가 부담합니다.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.625rem" }}>
                <span>💬</span>
                <div>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 700, color: "var(--mb-gray-900)" }}>
                    고객문의
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--mb-gray-600)", lineHeight: 1.6 }}>
                    이메일 : immodelkr@gmail.com
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 상세 설명 및 라이브 영상 탭 */}
      <ProductDetailTabs content={product.content} videos={videos} />

      {/* 연관 상품 */}
      {relatedProducts.length > 0 && (
        <div
          className="products-section"
          style={{ marginTop: "4rem" }}
        >
          <div className="section-header">
            <div>
              <p className="section-eyebrow">같은 카테고리</p>
              <h2 className="section-title">연관 상품</h2>
            </div>
            {product.category && (
              <Link
                href={`/products?category=${product.category.slug}`}
                className="section-link"
              >
                전체 보기 →
              </Link>
            )}
          </div>
          <div className="product-grid">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

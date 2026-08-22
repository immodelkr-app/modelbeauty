// ============================================================
// 홈 랜딩 페이지 — 모델뷰티 메인
// Hero + 카테고리 섹션 + 추천 상품 섹션
// ============================================================

import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductCard from "@/components/products/ProductCard";
import HeroVideoCard from "@/components/home/HeroVideoCard";
import { getModelBeautyYoutubeVideos, type YoutubeVideo } from "@/lib/youtube";
import { getModelBeautyInstagramPosts, type InstagramPost } from "@/lib/instagram";
import type { Category, Product } from "@/types";

export const metadata: Metadata = {
  title: "모델뷰티 | 뷰티의 시작",
  description:
    "뷰티의 시작, 모델뷰티. 엄선된 뷰티 제품을 합리적인 가격으로 만나보세요.",
};

// ── 카테고리 아이콘 매핑 ─────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  skincare: "🌸",
  makeup: "💄",
  body: "🧴",
  hair: "💆",
  sun: "☀️",
  mask: "😊",
};

const DEFAULT_ICON = "✨";

// ── 데이터 패칭 ──────────────────────────────────────────

interface ActiveStream {
  id: string;
  title: string;
  streamerName: string;
  coverImageUrl: string | null;
  streamUrl: string | null;
  viewerCount: number;
}

interface LastStream {
  id: string;
  title: string;
  streamerName: string;
  coverImageUrl: string | null;
  replayUrl: string | null;
}

const PRODUCT_SELECT = `id, name, slug, description, base_price, sale_price,
         stock_quantity, sku, images, tags, is_active, is_featured,
         created_at, updated_at, category_id,
         categories!products_category_id_fkey ( id, name, slug )`;

function mapProductRow(p: {
  id: string; name: string; slug: string; description: string | null;
  base_price: number; sale_price: number | null; stock_quantity: number;
  sku: string | null; images: unknown; tags: string[] | null;
  is_active: boolean; is_featured: boolean; created_at: string; updated_at: string;
  category_id: string | null;
  categories: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
}): Product {
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
    category: cat
      ? { id: cat.id, name: cat.name, slug: cat.slug, parentId: null, sortOrder: 0, imageUrl: null, isActive: true, createdAt: "" }
      : undefined,
  } satisfies Product;
}

async function getHomeData(): Promise<{
  categories: Category[];
  featured: Product[];
  allProducts: Product[];
  youtubeVideos: YoutubeVideo[];
  instagramPosts: InstagramPost[];
  activeStream: ActiveStream | null;
  lastStream: LastStream | null;
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: catData }, { data: prodData }, { data: allProdData }, { data: liveData }, youtubeVideos, instagramPosts] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .limit(6),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("live_streams")
      .select("id, title, streamer_name, cover_image_url, viewer_count, stream_url")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1),
    getModelBeautyYoutubeVideos(8),
    getModelBeautyInstagramPosts(8),
  ]);

  // 현재 라이브가 없으면 가장 최근 종료된 리플레이 조회
  let lastStreamData = null;
  if (!liveData || liveData.length === 0) {
    const { data } = await supabase
      .from("live_streams")
      .select("id, title, streamer_name, cover_image_url, replay_url")
      .eq("status", "ended")
      .not("replay_url", "is", null)
      .order("ended_at", { ascending: false })
      .limit(1);
    lastStreamData = data;
  }

  const categories: Category[] = (catData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    sortOrder: c.sort_order,
    imageUrl: c.image_url,
    isActive: c.is_active,
    createdAt: c.created_at,
  }));

  const featured: Product[] = (prodData ?? []).map(mapProductRow);
  const allProducts: Product[] = (allProdData ?? []).map(mapProductRow);

  const activeStream: ActiveStream | null = liveData && liveData.length > 0 ? {
    id: liveData[0].id,
    title: liveData[0].title,
    streamerName: liveData[0].streamer_name,
    coverImageUrl: liveData[0].cover_image_url,
    streamUrl: liveData[0].stream_url ?? null,
    viewerCount: liveData[0].viewer_count,
  } : null;

  const lastStream: LastStream | null = lastStreamData && lastStreamData.length > 0 ? {
    id: lastStreamData[0].id,
    title: lastStreamData[0].title,
    streamerName: lastStreamData[0].streamer_name,
    coverImageUrl: lastStreamData[0].cover_image_url,
    replayUrl: lastStreamData[0].replay_url ?? null,
  } : null;

  return { categories, featured, allProducts, youtubeVideos, instagramPosts, activeStream, lastStream };
}

// ── 페이지 컴포넌트 ───────────────────────────────────────

export default async function HomePage() {
  const { categories, featured, allProducts, youtubeVideos, instagramPosts, activeStream, lastStream } = await getHomeData();

  const APP_URL = "https://www.modelbeauty.kr";

  // ── JSON-LD: Organization + WebSite ────────────────────────
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "모델뷰티",
    alternateName: "Model Beauty",
    url: APP_URL,
    logo: `${APP_URL}/og-image.png`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "Korean",
    },
    sameAs: [],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "모델뷰티",
    url: APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${APP_URL}/products?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="shop-layout">
      {/* JSON-LD 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      <Header />

      <main className="shop-main">
        {/* ── 히어로 섹션 ─────────────────────────────── */}
        <section className="hero-section" aria-label="메인 배너">
          {/* 배경 블롭 */}
          <div className="hero-blob hero-blob-1" aria-hidden="true" />
          <div className="hero-blob hero-blob-2" aria-hidden="true" />

          <div className="hero-content">
            {/* 텍스트 */}
            <div>
              {activeStream ? (
                <div className="hero-badge" aria-label="실시간 라이브 쇼핑 방송 중" style={{ background: "rgba(124, 58, 237, 0.08)", color: "#7c3aed", borderColor: "rgba(124, 58, 237, 0.2)" }}>
                  <span className="hero-badge-dot" style={{ background: "#7c3aed" }} aria-hidden="true" />
                  🟣 LIVE 방송 진행 중
                </div>
              ) : (
                <div className="hero-badge" aria-label="새로운 소식">
                  <span className="hero-badge-dot" aria-hidden="true" />
                  신규 컬렉션 출시
                </div>
              )}

              <h1 className="hero-title">
                모델뷰티의 시작,
                <br />
                <span className="hero-title-accent">MODEL BEAUTY</span>
              </h1>

              <div className="hero-stats">
                {[
                  { value: "모델 실사용 검증", label: "깐깐하게 직접 써보고 셀렉한 프리미엄 제품" },
                  { value: "아임모델 전용", label: "패션·광고 모델 회원만을 위한 특별한 가격과 혜택" },
                  { value: "통합 포인트 결제", label: "MOCA 및 IMFF 앱 활동 적립금 사용 가능" },
                ].map((stat) => (
                  <div key={stat.value} style={{ flex: 1 }}>
                    <div className="hero-stat-value">{stat.value}</div>
                    <div className="hero-stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="hero-actions">
                {activeStream ? (
                  <Link href={`/live/${activeStream.id}`} className="hero-cta-primary" style={{ background: "#7c3aed", borderColor: "#7c3aed", boxShadow: "0 10px 25px rgba(124, 58, 237, 0.25)" }}>
                    🟣 실시간 방송 입장하기
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <Link href="/live" className="hero-cta-primary">
                    라이브 보러가기
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
                <Link href="/products?featured=true" className="hero-cta-secondary">
                  모델뷰티 아이템
                </Link>
              </div>
            </div>

            {/* 비주얼 - 라이브 방송 & 상품 쇼케이스 컨셉 */}
            <div className="hero-image-wrap">
              <div className="hero-image-card" style={{ display: "block", overflow: "visible" }}>
                {/* 메인 방송 영상 / 커버 카드 */}
                <HeroVideoCard
                  activeStream={activeStream}
                  lastStream={lastStream}
                />

                {/* 플로팅 추천 상품 카드 1 */}
                <div className="floating-product-card float-card-1" style={{
                  position: "absolute",
                  left: "-2.5rem",
                  top: "20%",
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  backdropFilter: "blur(12px)",
                  padding: "0.75rem",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  zIndex: 20
                }}>
                  <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden", background: "#f5f5f5" }}>
                    <Image src="/images/velvet_lipstick.png" alt="립스틱" fill style={{ objectFit: "cover" }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, margin: 0, color: "var(--mb-gray-900)" }}>벨벳 립스틱</h4>
                    <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--mb-pink-500)", margin: "0.125rem 0 0 0" }}>18,000원</p>
                  </div>
                </div>

                {/* 플로팅 추천 상품 카드 2 */}
                <div className="floating-product-card float-card-2" style={{
                  position: "absolute",
                  right: "-2.5rem",
                  bottom: "15%",
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  backdropFilter: "blur(12px)",
                  padding: "0.75rem",
                  borderRadius: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  zIndex: 20
                }}>
                  <div style={{ position: "relative", width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden", background: "#f5f5f5" }}>
                    <Image src="/images/moisture_cream.png" alt="크림" fill style={{ objectFit: "cover" }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, margin: 0, color: "var(--mb-gray-900)" }}>아쿠아 수분크림</h4>
                    <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--mb-pink-500)", margin: "0.125rem 0 0 0" }}>24,000원</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 카테고리 섹션 ─────────────────────────── */}
        <section className="category-section" aria-label="카테고리">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Category</p>
              <h2 className="section-title">카테고리</h2>
            </div>
            <Link href="/products" className="section-link">
              전체 보기 →
            </Link>
          </div>

          <div className="category-grid">
            {categories.length > 0 ? (
              categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="category-card"
                >
                  <span className="category-card-icon" aria-hidden="true">
                    {CATEGORY_ICONS[cat.slug] ?? DEFAULT_ICON}
                  </span>
                  {cat.name}
                </Link>
              ))
            ) : (
              // 데이터 없을 때 예시 카테고리
              [
                { slug: "skincare", name: "스킨케어", icon: "🌸" },
                { slug: "makeup", name: "메이크업", icon: "💄" },
                { slug: "body", name: "바디", icon: "🧴" },
                { slug: "hair", name: "헤어", icon: "💆" },
                { slug: "sun", name: "선케어", icon: "☀️" },
                { slug: "mask", name: "마스크팩", icon: "😊" },
              ].map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className="category-card"
                >
                  <span className="category-card-icon" aria-hidden="true">
                    {cat.icon}
                  </span>
                  {cat.name}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ── 추천 상품 섹션 ──────────────────────────── */}
        {featured.length > 0 && (
          <section className="products-section" aria-label="모델뷰티 베스트">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Model Beauty Best</p>
                <h2 className="section-title">모델뷰티 베스트</h2>
              </div>
              <Link href="/products?featured=true" className="section-link">
                전체 보기 →
              </Link>
            </div>
            <div className="product-grid">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ── 전체 상품 섹션 (3단 8열 그리드) ─────────── */}
        {allProducts.length > 0 && (
          <section className="products-section" aria-label="모델뷰티 전체상품">
            <div className="section-header" style={{ maxWidth: "1600px" }}>
              <div>
                <p className="section-eyebrow">All Products</p>
                <h2 className="section-title">모델뷰티 전체상품</h2>
              </div>
              <Link href="/products" className="section-link">
                전체 보기 →
              </Link>
            </div>
            <div className="product-grid-8col">
              {allProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ── 추천 상품 없을 때 빈 섹션 (CTA) ─────────── */}
        {featured.length === 0 && (
          <section
            style={{
              padding: "5rem 1.5rem",
              textAlign: "center",
              background: "var(--mb-gray-50)",
            }}
            aria-label="상품 보기 유도"
          >
            <p
              style={{
                fontSize: "3rem",
                marginBottom: "1.5rem",
              }}
              aria-hidden="true"
            >
              ✨
            </p>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color: "var(--mb-gray-900)",
                letterSpacing: "-0.03em",
                marginBottom: "0.75rem",
              }}
            >
              프리미엄 뷰티를 경험해보세요
            </h2>
            <p
              style={{
                fontSize: "1rem",
                color: "var(--mb-gray-500)",
                marginBottom: "2rem",
                lineHeight: 1.7,
              }}
            >
              현역 패션 모델들이 깐깐하게 검증한 최고의 뷰티 제품들을 만나보세요.
            </p>
            <Link href="/products" className="hero-cta-primary">
              상품 둘러보기 →
            </Link>
          </section>
        )}

        {/* ── 브랜드 가치 섹션 ─────────────────────────── */}
        <section
          style={{
            padding: "5rem 1.5rem",
            background: "#fff",
          }}
          aria-label="브랜드 가치"
        >
          <div className="brand-value-grid">
            {[
              {
                icon: "🧪",
                title: "성분 검증",
                desc: "현역 패션 모델들이 직접 써보고 검증한 최고의 성분만을 사용합니다.",
              },
              {
                icon: "🌿",
                title: "친환경 패키지",
                desc: "지속 가능한 지구를 위한 친환경 포장재를 사용합니다.",
              },
              {
                icon: "💝",
                title: "적립 포인트",
                desc: "구매 금액의 1%를 포인트로 적립해 다음 구매에 사용하세요.",
              },
              {
                icon: "🔄",
                title: "간편 반품",
                desc: "수령 후 7일 이내 무조건 무료 반품을 보장합니다.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "0.875rem",
                  padding: "2rem 1rem",
                  borderRadius: "20px",
                  background: "var(--mb-gray-50)",
                  border: "1px solid var(--mb-gray-100)",
                }}
              >
                <span style={{ fontSize: "2.5rem" }} aria-hidden="true">
                  {item.icon}
                </span>
                <h3
                  style={{
                    fontSize: "1.0625rem",
                    fontWeight: 700,
                    color: "var(--mb-gray-900)",
                    margin: 0,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--mb-gray-500)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 유튜브 섹션 (#모델뷰티 해시태그 영상) ─────── */}
        {youtubeVideos.length > 0 && (
          <section className="products-section" aria-label="모델뷰티 유튜브">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">YouTube</p>
                <h2 className="section-title">📺 모델뷰티 유튜브</h2>
              </div>
              <a
                href="https://www.youtube.com/@IM_MODEL_BEAUTY"
                target="_blank"
                rel="noopener noreferrer"
                className="section-link"
              >
                채널 바로가기 →
              </a>
            </div>
            <div className="youtube-grid">
              {youtubeVideos.map((video) => (
                <a
                  key={video.videoId}
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="youtube-card"
                >
                  <div className="youtube-card-thumb">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="youtube-card-play" aria-hidden="true">▶</span>
                  </div>
                  <p className="youtube-card-title">{video.title}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── 인스타그램 섹션 (@im_modelbeauty 자체 게시물) ─── */}
        {instagramPosts.length > 0 && (
          <section className="products-section" aria-label="모델뷰티 인스타그램">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Instagram</p>
                <h2 className="section-title">📷 모델뷰티 인스타그램</h2>
              </div>
              <a
                href="https://www.instagram.com/im_modelbeauty"
                target="_blank"
                rel="noopener noreferrer"
                className="section-link"
              >
                계정 바로가기 →
              </a>
            </div>
            <div className="instagram-grid">
              {instagramPosts.map((post) => (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="instagram-card"
                >
                  <Image
                    src={post.imageUrl}
                    alt={post.caption.slice(0, 60) || "모델뷰티 인스타그램 게시물"}
                    fill
                    sizes="(min-width: 1024px) 16.6vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  {post.mediaType === "VIDEO" && (
                    <span className="youtube-card-play" aria-hidden="true">▶</span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

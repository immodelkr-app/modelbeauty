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
  viewerCount: number;
}

async function getHomeData(): Promise<{
  categories: Category[];
  featured: Product[];
  activeStream: ActiveStream | null;
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: catData }, { data: prodData }, { data: liveData }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .limit(6),
    supabase
      .from("products")
      .select(
        `id, name, slug, description, base_price, sale_price,
         stock_quantity, sku, images, tags, is_active, is_featured,
         created_at, updated_at, category_id,
         categories ( id, name, slug )`
      )
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("live_streams")
      .select("id, title, streamer_name, cover_image_url, viewer_count")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

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

  const featured: Product[] = (prodData ?? []).map((p) => {
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
  });

  const activeStream = liveData && liveData.length > 0 ? {
    id: liveData[0].id,
    title: liveData[0].title,
    streamerName: liveData[0].streamer_name,
    coverImageUrl: liveData[0].cover_image_url,
    viewerCount: liveData[0].viewer_count,
  } : null;

  return { categories, featured, activeStream };
}

// ── 페이지 컴포넌트 ───────────────────────────────────────

export default async function HomePage() {
  const { categories, featured, activeStream } = await getHomeData();

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
                <div className="hero-badge" aria-label="실시간 라이브 쇼핑 방송 중" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }}>
                  <span className="hero-badge-dot" style={{ background: "#ef4444" }} aria-hidden="true" />
                  🔴 LIVE 방송 진행 중
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

              <p className="hero-desc">
                모델들이 일상에서 직접 사용해보고<br />
                깐깐하게 검증한 최고의 제품만 셀렉합니다.
              </p>

              <div className="hero-actions">
                {activeStream ? (
                  <Link href={`/live/${activeStream.id}`} className="hero-cta-primary" style={{ background: "#ef4444", borderColor: "#ef4444" }}>
                    🔴 실시간 방송 입장하기
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
                    지금 쇼핑하기
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
                  베스트 셀러 보기
                </Link>
              </div>

              <div className="hero-stats">
                {[
                  { value: "2,000+", label: "엄선된 상품" },
                  { value: "98%", label: "고객 만족도" },
                  { value: "50,000+", label: "누적 회원" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="hero-stat-value">{stat.value}</div>
                    <div className="hero-stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 비주얼 - 라이브 방송 & 상품 쇼케이스 컨셉 */}
            <div className="hero-image-wrap">
              <div className="hero-image-card" style={{ display: "block", overflow: "visible" }}>
                {/* 메인 방송 커버 이미지 */}
                <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "32px", overflow: "hidden" }}>
                  <Image
                    src={activeStream?.coverImageUrl || "/images/live_cover_makeup.png"}
                    alt={activeStream?.title || "뷰티 라이브 쇼"}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                    priority
                  />
                  {/* 그라데이션 오버레이 */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)"
                  }} />
                  
                  {/* 라이브 상태 배지 */}
                  <div style={{
                    position: "absolute",
                    top: "1.25rem",
                    left: "1.25rem",
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    zIndex: 10
                  }}>
                    <span className="visual-live-badge" style={{ position: "static", margin: 0, background: activeStream ? "#ef4444" : "var(--mb-pink-500)" }}>
                      {activeStream ? "ON AIR" : "LIVE"}
                    </span>
                    <span style={{
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.625rem",
                      borderRadius: "100px",
                      backdropFilter: "blur(4px)"
                    }}>
                      👤 {activeStream ? activeStream.viewerCount.toLocaleString() : "3,420"}명
                    </span>
                  </div>

                  {/* 중앙 플레이 버튼 */}
                  <Link
                    href={activeStream ? `/live/${activeStream.id}` : "/live"}
                    className="play-btn-glow"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: activeStream ? "#ef4444" : "var(--mb-pink-500)",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                      zIndex: 10,
                      transition: "transform 0.2s, background-color 0.2s"
                    }}
                    aria-label="라이브 보러가기"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </Link>

                  {/* 방송 제목 텍스트 */}
                  <div style={{
                    position: "absolute",
                    bottom: "1.5rem",
                    left: "1.5rem",
                    right: "1.5rem",
                    color: "#fff",
                    zIndex: 10
                  }}>
                    <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)", marginBottom: "0.25rem" }}>
                      {activeStream ? `스트리머 ${activeStream.streamerName}의` : "스트리머 지아(Jia)의"}
                    </p>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.3, margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                      {activeStream ? activeStream.title : "벨벳 립스틱 전색상 단독 특가 쇼!"}
                    </h3>
                  </div>
                </div>

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
          <section className="products-section" aria-label="베스트 셀러">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Best Seller</p>
                <h2 className="section-title">베스트 셀러</h2>
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
          <div
            style={{
              maxWidth: "1280px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "2rem",
            }}
          >
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
      </main>

      <Footer />
    </div>
  );
}

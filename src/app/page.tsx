// ============================================================
// 홈 랜딩 페이지 — 모델뷰티 메인
// Hero + 카테고리 섹션 + 추천 상품 섹션
// ============================================================

import Link from "next/link";
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

async function getHomeData(): Promise<{
  categories: Category[];
  featured: Product[];
}> {
  const supabase = await createSupabaseServerClient();

  const [{ data: catData }, { data: prodData }] = await Promise.all([
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

  return { categories, featured };
}

// ── 페이지 컴포넌트 ───────────────────────────────────────

export default async function HomePage() {
  const { categories, featured } = await getHomeData();

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
              <div className="hero-badge" aria-label="새로운 소식">
                <span className="hero-badge-dot" aria-hidden="true" />
                신규 컬렉션 출시
              </div>

              <h1 className="hero-title">
                모델뷰티의 시작,
                <br />
                <span className="hero-title-accent">MODEL BEAUTY</span>
              </h1>

              <p className="hero-desc">
                피부과 전문의와 함께 엄선한 뷰티 제품들.<br />
                당신의 피부가 빛나는 순간을 위한 특별한 선택.
              </p>

              <div className="hero-actions">
                <Link href="/products" className="hero-cta-primary">
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

            {/* 비주얼 */}
            <div className="hero-image-wrap" aria-hidden="true">
              <div className="hero-image-card">
                <div className="hero-image-inner">💄</div>
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
              피부과 전문의가 추천하는 엄선된 뷰티 제품들을 만나보세요.
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
                desc: "피부과 전문의와 함께 엄선한 안전한 성분만을 사용합니다.",
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

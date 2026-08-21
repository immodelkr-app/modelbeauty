// ============================================================
// GET /products — 상품 목록 페이지 (Server Component)
// searchParams: category, search, sort, page
// ============================================================

import { Suspense } from "react";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductCard, { ProductCardSkeleton } from "@/components/products/ProductCard";
import ProductFilters from "@/components/products/ProductFilters";
import type { Category, Product } from "@/types";

export const metadata: Metadata = {
  title: "전체 상품",
  description: "모델뷰티의 엄선된 뷰티 제품을 만나보세요. 스킨케어, 메이크업, 바디, 헤어 등 다양한 카테고리.",
};

const PAGE_LIMIT = 20;

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
    featured?: string;
  }>;
}

// ── 데이터 패칭 ────────────────────────────────────────────

async function getCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parent_id,
    sortOrder: c.sort_order,
    imageUrl: c.image_url,
    isActive: c.is_active,
    createdAt: c.created_at,
  }));
}

async function getProducts(params: {
  category?: string;
  search?: string;
  sort?: string;
  page: number;
  featured?: boolean;
}): Promise<{ items: Product[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { page, category, search, sort = "latest", featured } = params;
  const offset = (page - 1) * PAGE_LIMIT;

  // 카테고리 slug → id
  let categoryId: string | null = null;
  if (category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .eq("is_active", true)
      .single();
    if (cat) categoryId = cat.id;
  }

  // 카테고리 필터 대상 상품 ID 목록 (다중 카테고리 매핑 포함)
  let categoryProductIds: string[] | null = null;
  if (categoryId) {
    const { data: mappedRows } = await supabase
      .from("product_categories")
      .select("product_id")
      .eq("category_id", categoryId);
    categoryProductIds = (mappedRows ?? []).map((r) => r.product_id);
  }

  let countQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  let dataQuery = supabase
    .from("products")
    .select(
      `id, name, slug, description, base_price, sale_price,
       stock_quantity, sku, images, tags, is_active, is_featured,
       created_at, updated_at, category_id,
       categories ( id, name, slug )`
    )
    .eq("is_active", true);

  if (categoryProductIds) {
    const ids = categoryProductIds.length > 0 ? categoryProductIds : ["00000000-0000-0000-0000-000000000000"];
    countQuery = countQuery.in("id", ids);
    dataQuery = dataQuery.in("id", ids);
  }
  if (search) {
    const f = `name.ilike.%${search}%,description.ilike.%${search}%`;
    countQuery = countQuery.or(f);
    dataQuery = dataQuery.or(f);
  }
  if (featured) {
    countQuery = countQuery.eq("is_featured", true);
    dataQuery = dataQuery.eq("is_featured", true);
  }

  switch (sort) {
    case "price_asc":
      dataQuery = dataQuery.order("base_price", { ascending: true });
      break;
    case "price_desc":
      dataQuery = dataQuery.order("base_price", { ascending: false });
      break;
    default:
      dataQuery = dataQuery.order("created_at", { ascending: false });
  }

  dataQuery = dataQuery.range(offset, offset + PAGE_LIMIT - 1);

  const [{ count }, { data }] = await Promise.all([countQuery, dataQuery]);

  const items = (data ?? []).map((p) => {
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

  return { items, total: count ?? 0 };
}

// ── 페이지 컴포넌트 ────────────────────────────────────────

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const [categories, { items: products, total }] = await Promise.all([
    getCategories(),
    getProducts({
      category: sp.category,
      search: sp.search,
      sort: sp.sort,
      page,
      featured: sp.featured === "true",
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="products-page">
      {/* 필터 (클라이언트 컴포넌트 — Suspense 필요) */}
      <Suspense fallback={<div style={{ height: "140px" }} />}>
        <ProductFilters categories={categories} totalCount={total} />
      </Suspense>

      {/* 상품 그리드 */}
      {products.length === 0 ? (
        <div className="products-empty">
          <div className="products-empty-icon">🔍</div>
          <h3>상품을 찾을 수 없습니다</h3>
          <p>
            {sp.search
              ? `"${sp.search}"에 맞는 상품이 없습니다. 다른 검색어를 입력해 보세요.`
              : "해당 카테고리에 등록된 상품이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Suspense>
          <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
        </Suspense>
      )}
    </div>
  );
}

// ── 페이지네이션 ─────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
  );

  return (
    <nav
      aria-label="페이지 이동"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "0.375rem",
        marginTop: "3rem",
        flexWrap: "wrap",
      }}
    >
      {pages.map((p, idx) => {
        const isActive = p === currentPage;
        const prevPage = pages[idx - 1];
        const showEllipsis = prevPage && p - prevPage > 1;

        return (
          <span key={p} style={{ display: "flex", gap: "0.375rem" }}>
            {showEllipsis && (
              <span
                style={{
                  padding: "0.5rem 0.75rem",
                  color: "var(--mb-gray-400)",
                  fontSize: "0.875rem",
                }}
              >
                …
              </span>
            )}
            <a
              href={buildHref(p)}
              aria-label={`${p}페이지`}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                fontSize: "0.875rem",
                fontWeight: isActive ? 700 : 500,
                textDecoration: "none",
                background: isActive ? "var(--mb-gradient)" : "#fff",
                color: isActive ? "#fff" : "var(--mb-gray-700)",
                border: isActive ? "none" : "1.5px solid var(--mb-gray-200)",
                boxShadow: isActive ? "var(--shadow-pink)" : undefined,
                transition: "all 0.2s",
              }}
            >
              {p}
            </a>
          </span>
        );
      })}
    </nav>
  );
}

// ── 스켈레톤 폴백 ────────────────────────────────────────

export function ProductsGridSkeleton() {
  return (
    <div className="product-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

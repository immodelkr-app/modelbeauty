// ============================================================
// GET /api/products — 상품 목록 조회 (페이지네이션, 필터, 검색)
// Query Params:
//   page     : number (default: 1)
//   limit    : number (default: 20, max: 100)
//   category : string (카테고리 slug)
//   search   : string (이름/설명 검색)
//   tag      : string (태그 필터)
//   sort     : 'latest' | 'price_asc' | 'price_desc' (default: 'latest')
//   featured : 'true' (추천 상품만)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const sort = searchParams.get("sort") ?? "latest";
    const featuredOnly = searchParams.get("featured") === "true";

    const offset = (page - 1) * limit;

    const supabase = await createSupabaseServerClient();

    // 카테고리 slug → id 변환
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

    // 기본 쿼리 빌더 (count 용)
    let countQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    // 데이터 쿼리 빌더
    let dataQuery = supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        description,
        base_price,
        sale_price,
        stock_quantity,
        sku,
        images,
        tags,
        is_active,
        is_featured,
        created_at,
        updated_at,
        category_id,
        categories!inner (
          id,
          name,
          slug
        )
      `
      )
      .eq("is_active", true);

    // 필터: 카테고리 (대표 카테고리 매치가 아닌, 다중 매핑 전체 매치)
    if (categoryProductIds) {
      const ids = categoryProductIds.length > 0 ? categoryProductIds : ["00000000-0000-0000-0000-000000000000"];
      countQuery = countQuery.in("id", ids);
      dataQuery = dataQuery.in("id", ids);
    }

    // 필터: 검색어
    if (search) {
      const searchFilter = `name.ilike.%${search}%,description.ilike.%${search}%`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }

    // 필터: 태그
    if (tag) {
      countQuery = countQuery.contains("tags", [tag]);
      dataQuery = dataQuery.contains("tags", [tag]);
    }

    // 필터: 추천 상품
    if (featuredOnly) {
      countQuery = countQuery.eq("is_featured", true);
      dataQuery = dataQuery.eq("is_featured", true);
    }

    // 정렬
    switch (sort) {
      case "price_asc":
        dataQuery = dataQuery.order("sale_price", { ascending: true, nullsFirst: false });
        break;
      case "price_desc":
        dataQuery = dataQuery.order("sale_price", { ascending: false, nullsFirst: false });
        break;
      case "latest":
      default:
        dataQuery = dataQuery.order("created_at", { ascending: false });
        break;
    }

    // 페이지네이션
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // 병렬 실행
    const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);

    if (error) {
      console.error("[GET /api/products] Supabase error:", error);
      return Response.json(
        { success: false, error: "상품 목록 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    // snake_case → camelCase 변환
    const products = (data ?? []).map((p) => {
      const category = Array.isArray(p.categories)
        ? p.categories[0]
        : p.categories;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        basePrice: p.base_price,
        salePrice: p.sale_price,
        stockQuantity: p.stock_quantity,
        sku: p.sku,
        images: p.images ?? [],
        tags: p.tags ?? [],
        isActive: p.is_active,
        isFeatured: p.is_featured,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        categoryId: p.category_id,
        category: category
          ? {
              id: category.id,
              name: category.name,
              slug: category.slug,
            }
          : null,
      };
    });

    return Response.json({
      success: true,
      data: {
        items: products,
        total,
        page,
        limit,
        hasMore: offset + products.length < total,
      },
    });
  } catch (err) {
    console.error("[GET /api/products] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

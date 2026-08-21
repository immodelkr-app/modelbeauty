// ============================================================
// GET  /api/admin/products — 상품 목록 (Admin Only)
// POST /api/admin/products — 상품 등록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const search = url.searchParams.get("search") ?? "";
    const categoryId = url.searchParams.get("categoryId") ?? "";
    const status = url.searchParams.get("status") ?? ""; // active | inactive | all
    const offset = (page - 1) * limit;

    const admin = createSupabaseAdmin();

    // 카테고리 필터: 대표 카테고리(category_id)뿐 아니라 다중 매핑(product_categories)도 매치
    let categoryFilterProductIds: string[] | null = null;
    if (categoryId) {
      const { data: mappedRows } = await admin
        .from("product_categories")
        .select("product_id")
        .eq("category_id", categoryId);
      categoryFilterProductIds = (mappedRows ?? []).map((r) => r.product_id);
    }

    let query = admin
      .from("products")
      .select(
        `id, name, slug, base_price, sale_price, stock_quantity,
         is_active, is_featured, sku, images, created_at, updated_at,
         vendor_id, vendor_cost_type, vendor_cost_rate, vendor_supply_price,
         categories!products_category_id_fkey ( id, name, slug ),
         product_categories ( categories ( id, name, slug ) ),
         vendors ( id, name )`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike("name", `%${search}%`);
    if (categoryFilterProductIds) query = query.in("id", categoryFilterProductIds.length > 0 ? categoryFilterProductIds : ["00000000-0000-0000-0000-000000000000"]);
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);

    const { data, error, count } = await query;
    if (error) throw error;

    const products = (data ?? []).map((p) => {
      const cat = Array.isArray(p.categories) ? p.categories[0] : p.categories;
      const vendor = Array.isArray(p.vendors) ? p.vendors[0] : p.vendors;
      const allCategories = (p.product_categories as { categories: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] }[] ?? [])
        .map((pc) => (Array.isArray(pc.categories) ? pc.categories[0] : pc.categories))
        .filter((c): c is { id: string; name: string; slug: string } => !!c);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        basePrice: p.base_price,
        salePrice: p.sale_price,
        stockQuantity: p.stock_quantity,
        isActive: p.is_active,
        isFeatured: p.is_featured,
        sku: p.sku,
        thumbnail: (p.images as { url: string }[])?.[0]?.url ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        vendorId: p.vendor_id,
        vendorCostType: p.vendor_cost_type,
        vendorCostRate: p.vendor_cost_rate,
        vendorSupplyPrice: p.vendor_supply_price,
        category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
        categories: allCategories.length > 0 ? allCategories : (cat ? [{ id: cat.id, name: cat.name, slug: cat.slug }] : []),
        vendor: vendor ? { id: vendor.id, name: vendor.name } : null,
      };
    });

    return Response.json({
      success: true,
      data: { products, total: count ?? 0, page, limit, hasMore: (count ?? 0) > offset + limit },
    });
  } catch (err) {
    console.error("[GET /api/admin/products]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      name,
      slug,
      categoryIds,
      description,
      content,
      basePrice,
      salePrice,
      stockQuantity,
      sku,
      images,
      tags,
      isActive,
      isFeatured,
      options,
      variants,
      recommenderCrewId,
      recommendationNote,
      vendorId,
      vendorCostType = "rate",
      vendorCostRate = 0,
      vendorSupplyPrice = 0,
    } = body;

    // 필수 필드 검증
    if (!name || !slug) {
      return Response.json(
        { success: false, error: "name과 slug는 필수입니다." },
        { status: 400 }
      );
    }
    if (basePrice === undefined || basePrice === null || basePrice < 0) {
      return Response.json(
        { success: false, error: "basePrice는 0 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return Response.json(
        { success: false, error: "slug는 소문자, 숫자, 하이픈(-)만 사용 가능합니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();
    const categoryIdList: string[] = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : [];

    // 1. 상품 등록 (category_id는 대표 카테고리 = 선택한 카테고리 중 첫 번째)
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({
        name,
        slug,
        category_id: categoryIdList[0] ?? null,
        description: description ?? null,
        content: content ?? null,
        base_price: basePrice,
        sale_price: salePrice ?? null,
        stock_quantity: stockQuantity ?? 0,
        sku: sku ?? null,
        images: images ?? [],
        tags: tags ?? [],
        is_active: isActive ?? true,
        is_featured: isFeatured ?? false,
        recommender_crew_id: recommenderCrewId ?? null,
        recommendation_note: recommendationNote ?? null,
        vendor_id: vendorId ?? null,
        vendor_cost_type: vendorCostType,
        vendor_cost_rate: Number(vendorCostRate),
        vendor_supply_price: Number(vendorSupplyPrice),
      })
      .select()
      .single();

    if (productError) {
      if (productError.code === "23505") {
        return Response.json(
          { success: false, error: "이미 사용 중인 slug 또는 SKU입니다." },
          { status: 409 }
        );
      }
      console.error("[POST /api/admin/products] Product insert error:", productError);
      return Response.json(
        { success: false, error: "상품 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    // 1.5. 카테고리 매핑 등록 (다중 선택 지원)
    if (categoryIdList.length > 0) {
      const { error: catError } = await admin
        .from("product_categories")
        .insert(categoryIdList.map((categoryId) => ({ product_id: product.id, category_id: categoryId })));
      if (catError) {
        console.error("[POST /api/admin/products] Category mapping insert error:", catError);
        // 매핑 등록 실패해도 상품은 유지, 경고만 로그
      }
    }

    // 2. 옵션 등록 (있는 경우)
    let insertedOptions: unknown[] = [];
    if (options && Array.isArray(options) && options.length > 0) {
      const optionRows = options.map(
        (opt: { name: string; values: string[]; sortOrder?: number }, idx: number) => ({
          product_id: product.id,
          name: opt.name,
          values: opt.values,
          sort_order: opt.sortOrder ?? idx,
        })
      );
      const { data: optData, error: optError } = await admin
        .from("product_options")
        .insert(optionRows)
        .select();

      if (optError) {
        console.error("[POST /api/admin/products] Option insert error:", optError);
        // 옵션 등록 실패해도 상품은 유지, 경고만 로그
      } else {
        insertedOptions = optData ?? [];
      }
    }

    // 3. 변형 등록 (있는 경우)
    let insertedVariants: unknown[] = [];
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantRows = variants.map(
        (v: {
          optionValues: Record<string, string>;
          sku?: string;
          priceAdjustment?: number;
          stockQuantity?: number;
        }) => ({
          product_id: product.id,
          option_values: v.optionValues,
          sku: v.sku ?? null,
          price_adjustment: v.priceAdjustment ?? 0,
          stock_quantity: v.stockQuantity ?? 0,
          is_active: true,
        })
      );
      const { data: varData, error: varError } = await admin
        .from("product_variants")
        .insert(variantRows)
        .select();

      if (varError) {
        console.error("[POST /api/admin/products] Variant insert error:", varError);
        // 변형 등록 실패해도 상품은 유지
      } else {
        insertedVariants = varData ?? [];
      }
    }

    return Response.json(
      {
        success: true,
        data: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          basePrice: product.base_price,
          salePrice: product.sale_price,
          stockQuantity: product.stock_quantity,
          isActive: product.is_active,
          isFeatured: product.is_featured,
          createdAt: product.created_at,
          optionsCount: insertedOptions.length,
          variantsCount: insertedVariants.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/products] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

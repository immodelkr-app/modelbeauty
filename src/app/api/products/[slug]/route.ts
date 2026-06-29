// ============================================================
// GET /api/products/[slug] — 상품 상세 조회 (옵션/변형 포함)
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return Response.json(
        { success: false, error: "slug가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 상품 기본 정보 + 카테고리 조인
    const { data: product, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        description,
        content,
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
        categories (
          id,
          name,
          slug,
          parent_id
        )
      `
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !product) {
      if (error?.code === "PGRST116" || !product) {
        return Response.json(
          { success: false, error: "상품을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      console.error("[GET /api/products/[slug]] Supabase error:", error);
      return Response.json(
        { success: false, error: "상품 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // 옵션 조회
    const { data: options } = await supabase
      .from("product_options")
      .select("id, name, values, sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true });

    // 변형 조회 (활성화된 것만)
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, option_values, sku, price_adjustment, stock_quantity, is_active, created_at")
      .eq("product_id", product.id)
      .eq("is_active", true);

    // 응답 조합 (camelCase)
    const category = Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories;

    const responseData = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      content: product.content,
      basePrice: product.base_price,
      salePrice: product.sale_price,
      stockQuantity: product.stock_quantity,
      sku: product.sku,
      images: product.images ?? [],
      tags: product.tags ?? [],
      isActive: product.is_active,
      isFeatured: product.is_featured,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      categoryId: product.category_id,
      category: category
        ? {
            id: category.id,
            name: category.name,
            slug: category.slug,
            parentId: category.parent_id,
          }
        : null,
      options: (options ?? []).map((o) => ({
        id: o.id,
        name: o.name,
        values: o.values,
        sortOrder: o.sort_order,
      })),
      variants: (variants ?? []).map((v) => ({
        id: v.id,
        optionValues: v.option_values,
        sku: v.sku,
        priceAdjustment: v.price_adjustment,
        stockQuantity: v.stock_quantity,
        isActive: v.is_active,
        createdAt: v.created_at,
      })),
    };

    return Response.json({ success: true, data: responseData });
  } catch (err) {
    console.error("[GET /api/products/[slug]] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

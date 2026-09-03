// ============================================================
// GET    /api/admin/products/[id] — 상품 상세
// PATCH  /api/admin/products/[id] — 상품 수정 (Admin Only)
// DELETE /api/admin/products/[id] — 상품 삭제 (Admin Only, Cascade)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sanitizeProductContent } from "@/lib/sanitize-product-content";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("products")
      .select(`*, categories!products_category_id_fkey ( id, name, slug ), product_options ( * ), product_variants ( * ), live_crews ( id, name, nickname )`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return Response.json({ success: false, error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const { data: categoryMappings } = await admin
      .from("product_categories")
      .select("category_id")
      .eq("product_id", id);
    const categoryIds = (categoryMappings ?? []).map((r) => r.category_id);

    // 연관상품 (수동 지정) — 순서대로 상품 정보까지 함께 조회
    const { data: relatedMappings } = await admin
      .from("product_related_products")
      .select("related_product_id, sort_order")
      .eq("product_id", id)
      .order("sort_order", { ascending: true });
    const relatedIds = (relatedMappings ?? []).map((r) => r.related_product_id);
    let relatedProducts: { id: string; name: string; thumbnail: string | null }[] = [];
    if (relatedIds.length > 0) {
      const { data: relatedRows } = await admin
        .from("products")
        .select("id, name, images")
        .in("id", relatedIds);
      const byId = new Map((relatedRows ?? []).map((r) => [r.id, r]));
      relatedProducts = relatedIds
        .map((rid) => byId.get(rid))
        .filter((r): r is { id: string; name: string; images: unknown } => !!r)
        .map((r) => ({
          id: r.id,
          name: r.name,
          thumbnail: (r.images as { url: string }[] | null)?.[0]?.url ?? null,
        }));
    }

    return Response.json({ success: true, data: { ...data, categoryIds, relatedProducts } });
  } catch (err) {
    console.error("[GET /api/admin/products/[id]]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      slug,
      categoryIds,
      description,
      content,
      detailContentType,
      basePrice,
      salePrice,
      stockQuantity,
      sku,
      images,
      tags,
      isActive,
      isFeatured,
      recommenderCrewId,
      recommendationNote,
      relatedProductIds,
    } = body;

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json(
        { success: false, error: "slug는 소문자, 숫자, 하이픈(-)만 사용 가능합니다." },
        { status: 400 }
      );
    }
    if (basePrice !== undefined && basePrice < 0) {
      return Response.json(
        { success: false, error: "basePrice는 0 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 업데이트할 필드만 포함
    const categoryIdList: string[] | undefined = Array.isArray(categoryIds)
      ? categoryIds.filter(Boolean)
      : undefined;
    const relatedProductIdList: string[] | undefined = Array.isArray(relatedProductIds)
      ? relatedProductIds.filter((rid: string) => rid && rid !== id)
      : undefined;

    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (slug !== undefined) updatePayload.slug = slug;
    if (categoryIdList !== undefined) updatePayload.category_id = categoryIdList[0] ?? null;
    if (description !== undefined) updatePayload.description = description;
    if (content !== undefined) updatePayload.content = sanitizeProductContent(content);
    if (detailContentType !== undefined) updatePayload.detail_content_type = detailContentType === "editor" ? "editor" : "images";
    if (basePrice !== undefined) updatePayload.base_price = basePrice;
    if (salePrice !== undefined) updatePayload.sale_price = salePrice;
    if (stockQuantity !== undefined) updatePayload.stock_quantity = stockQuantity;
    if (sku !== undefined) updatePayload.sku = sku;
    if (images !== undefined) updatePayload.images = images;
    if (tags !== undefined) updatePayload.tags = tags;
    if (isActive !== undefined) updatePayload.is_active = isActive;
    if (isFeatured !== undefined) updatePayload.is_featured = isFeatured;
    // recommenderCrewId: null 전달 시 크루 연결 해제 지원
    if (recommenderCrewId !== undefined) updatePayload.recommender_crew_id = recommenderCrewId || null;
    if (recommendationNote !== undefined) updatePayload.recommendation_note = recommendationNote || null;

    if (Object.keys(updatePayload).length === 0) {
      return Response.json(
        { success: false, error: "수정할 항목이 없습니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("products")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json(
          { success: false, error: "상품을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      if (error.code === "23505") {
        return Response.json(
          { success: false, error: "이미 사용 중인 slug 또는 SKU입니다." },
          { status: 409 }
        );
      }
      console.error("[PATCH /api/admin/products/[id]] Supabase error:", error);
      return Response.json(
        { success: false, error: "상품 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    // 카테고리 매핑 갱신 (다중 선택 지원) — 기존 매핑 전체 삭제 후 재삽입
    if (categoryIdList !== undefined) {
      await admin.from("product_categories").delete().eq("product_id", id);
      if (categoryIdList.length > 0) {
        const { error: catError } = await admin
          .from("product_categories")
          .insert(categoryIdList.map((categoryId) => ({ product_id: id, category_id: categoryId })));
        if (catError) {
          console.error("[PATCH /api/admin/products/[id]] Category mapping update error:", catError);
        }
      }
    }

    // 연관상품 매핑 갱신 — 기존 매핑 전체 삭제 후 순서대로 재삽입
    if (relatedProductIdList !== undefined) {
      await admin.from("product_related_products").delete().eq("product_id", id);
      if (relatedProductIdList.length > 0) {
        const { error: relatedError } = await admin
          .from("product_related_products")
          .insert(
            relatedProductIdList.map((relatedId, idx) => ({
              product_id: id,
              related_product_id: relatedId,
              sort_order: idx,
            }))
          );
        if (relatedError) {
          console.error("[PATCH /api/admin/products/[id]] Related product mapping update error:", relatedError);
        }
      }
    }

    return Response.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        basePrice: data.base_price,
        salePrice: data.sale_price,
        stockQuantity: data.stock_quantity,
        isActive: data.is_active,
        isFeatured: data.is_featured,
        updatedAt: data.updated_at,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/admin/products/[id]] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();

    // 상품 삭제 (product_options, product_variants는 CASCADE 삭제)
    const { error } = await admin.from("products").delete().eq("id", id);

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json(
          { success: false, error: "상품을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      console.error("[DELETE /api/admin/products/[id]] Supabase error:", error);
      return Response.json(
        { success: false, error: "상품 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: "상품이 삭제되었습니다." });
  } catch (err) {
    console.error("[DELETE /api/admin/products/[id]] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

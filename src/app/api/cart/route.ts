// ============================================================
// GET  /api/cart  — 내 장바구니 목록
// POST /api/cart  — 상품 추가 (동일 상품+변형이면 수량 합산 upsert)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

// ── 인증 헬퍼 ────────────────────────────────────────────

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // user_metadata에 master_user_id 캐싱 (auth/sync 시 저장됨)
  const masterUserId =
    user.user_metadata?.master_user_id as string | undefined;
  return masterUserId ?? null;
}

// ── GET ──────────────────────────────────────────────────

export async function GET() {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("cart_items")
      .select(
        `id, quantity, created_at, updated_at,
         products (
           id, name, slug, base_price, sale_price,
           stock_quantity, images,
           categories ( id, name, slug )
         ),
         product_variants (
           id, option_values, price_adjustment, stock_quantity, sku
         )`
      )
      .eq("master_user_id", masterUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/cart]", error);
      return Response.json(
        { success: false, error: "장바구니 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // snake_case → camelCase 변환
    const items = (data ?? []).map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const variant = Array.isArray(item.product_variants)
        ? item.product_variants[0]
        : item.product_variants;
      const category = product && (Array.isArray(product.categories)
        ? product.categories[0]
        : product.categories);

      const basePrice = product?.base_price ?? 0;
      const salePrice = product?.sale_price ?? null;
      const priceAdjustment = variant?.price_adjustment ?? 0;
      const unitPrice = (salePrice ?? basePrice) + priceAdjustment;

      return {
        id: item.id,
        masterUserId,
        quantity: item.quantity,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        unitPrice,
        subtotal: unitPrice * item.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              slug: product.slug,
              basePrice: product.base_price,
              salePrice: product.sale_price,
              stockQuantity: product.stock_quantity,
              images: product.images ?? [],
              category: category ?? null,
            }
          : null,
        variant: variant
          ? {
              id: variant.id,
              optionValues: variant.option_values,
              priceAdjustment: variant.price_adjustment,
              stockQuantity: variant.stock_quantity,
              sku: variant.sku,
            }
          : null,
      };
    });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return Response.json({ success: true, data: { items, total, itemCount } });
  } catch (err) {
    console.error("[GET /api/cart] Unexpected:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ── POST ─────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, variantId, quantity = 1 } = body;

    if (!productId) {
      return Response.json(
        { success: false, error: "productId는 필수입니다." },
        { status: 400 }
      );
    }
    if (quantity < 1 || !Number.isInteger(quantity)) {
      return Response.json(
        { success: false, error: "수량은 1 이상의 정수여야 합니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // 상품 재고 확인
    const { data: product } = await admin
      .from("products")
      .select("id, stock_quantity, is_active")
      .eq("id", productId)
      .eq("is_active", true)
      .single();

    if (!product) {
      return Response.json(
        { success: false, error: "존재하지 않는 상품입니다." },
        { status: 404 }
      );
    }

    // 동일 상품+변형이 이미 장바구니에 있으면 수량 합산 (upsert)
    const { data: existing } = await admin
      .from("cart_items")
      .select("id, quantity")
      .eq("master_user_id", masterUserId)
      .eq("product_id", productId)
      .is("variant_id", variantId ?? null)
      .maybeSingle();

    if (existing) {
      const newQty = existing.quantity + quantity;
      const { error } = await admin
        .from("cart_items")
        .update({ quantity: newQty })
        .eq("id", existing.id);

      if (error) throw error;
      return Response.json({
        success: true,
        message: "수량이 업데이트되었습니다.",
        data: { id: existing.id, quantity: newQty },
      });
    }

    // 신규 추가
    const { data: newItem, error } = await admin
      .from("cart_items")
      .insert({
        master_user_id: masterUserId,
        product_id: productId,
        variant_id: variantId ?? null,
        quantity,
      })
      .select("id, quantity")
      .single();

    if (error) throw error;

    return Response.json(
      { success: true, message: "장바구니에 담겼습니다.", data: newItem },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/cart] Unexpected:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

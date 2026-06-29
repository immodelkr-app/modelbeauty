// ============================================================
// GET  /api/wishlist  — 위시리스트 목록
// POST /api/wishlist  — 위시리스트 추가 (이미 있으면 409)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (user?.user_metadata?.master_user_id as string) ?? null;
}

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
      .from("wishlist_items")
      .select(
        `id, created_at,
         products (
           id, name, slug, base_price, sale_price,
           stock_quantity, images, is_featured,
           categories ( id, name, slug )
         )`
      )
      .eq("master_user_id", masterUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const items = (data ?? []).map((item) => {
      const product = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const category = product && (Array.isArray(product.categories)
        ? product.categories[0]
        : product.categories);

      return {
        id: item.id,
        masterUserId,
        createdAt: item.created_at,
        product: product
          ? {
              id: product.id,
              name: product.name,
              slug: product.slug,
              basePrice: product.base_price,
              salePrice: product.sale_price,
              stockQuantity: product.stock_quantity,
              images: product.images ?? [],
              isFeatured: product.is_featured,
              category: category ?? null,
            }
          : null,
      };
    });

    return Response.json({ success: true, data: items });
  } catch (err) {
    console.error("[GET /api/wishlist]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

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
    const { productId } = body;

    if (!productId) {
      return Response.json(
        { success: false, error: "productId는 필수입니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // 상품 존재 확인
    const { data: product } = await admin
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("is_active", true)
      .single();

    if (!product) {
      return Response.json(
        { success: false, error: "존재하지 않는 상품입니다." },
        { status: 404 }
      );
    }

    const { data, error } = await admin
      .from("wishlist_items")
      .insert({ master_user_id: masterUserId, product_id: productId })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json(
          { success: false, error: "이미 위시리스트에 있습니다." },
          { status: 409 }
        );
      }
      throw error;
    }

    return Response.json(
      { success: true, message: "위시리스트에 추가되었습니다.", data },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/wishlist]", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

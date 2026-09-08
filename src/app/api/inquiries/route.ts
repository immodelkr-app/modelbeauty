// ============================================================
// GET  /api/inquiries — 내 문의 목록 (카테고리 필터 가능, 로그인 필요)
// POST /api/inquiries — 문의 작성 (로그인 필요)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

const CATEGORIES = ["product", "trial", "app", "etc"] as const;
type Category = (typeof CATEGORIES)[number];

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function GET(request: Request) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const admin = createSupabaseAdmin();
    let query = admin
      .from("inquiries")
      .select(
        `id, category, product_id, title, status, created_at, answered_at,
         products ( id, name, slug )`
      )
      .eq("master_user_id", masterUserId)
      .order("created_at", { ascending: false });

    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((r) => {
      const product = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        id: r.id,
        category: r.category,
        title: r.title,
        status: r.status,
        createdAt: r.created_at,
        answeredAt: r.answered_at,
        product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
      };
    });

    return Response.json({ success: true, data: items });
  } catch (err) {
    console.error("[GET /api/inquiries]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { category, productId, title, body: content, images, isPrivate } = body as {
      category?: Category;
      productId?: string;
      title?: string;
      body?: string;
      images?: { url: string }[];
      isPrivate?: boolean;
    };

    if (!category || !(CATEGORIES as readonly string[]).includes(category)) {
      return Response.json({ success: false, error: "문의 유형을 선택해주세요." }, { status: 400 });
    }
    if (!title?.trim() || title.trim().length > 100) {
      return Response.json({ success: false, error: "제목은 1~100자로 입력해주세요." }, { status: 400 });
    }
    if (!content?.trim() || content.trim().length > 2000) {
      return Response.json({ success: false, error: "문의 내용은 1~2000자로 입력해주세요." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 제품문의에 상품을 지정한 경우 존재 확인
    if (category === "product" && productId) {
      const { data: product } = await admin.from("products").select("id").eq("id", productId).single();
      if (!product) {
        return Response.json({ success: false, error: "존재하지 않는 상품입니다." }, { status: 404 });
      }
    }

    const { data, error } = await admin
      .from("inquiries")
      .insert({
        master_user_id: masterUserId,
        category,
        product_id: category === "product" ? (productId ?? null) : null,
        title: title.trim(),
        body: content.trim(),
        images: images ?? [],
        is_private: isPrivate ?? true,
      })
      .select("id")
      .single();

    if (error) throw error;

    return Response.json(
      { success: true, message: "문의가 접수되었습니다.", data },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/inquiries]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

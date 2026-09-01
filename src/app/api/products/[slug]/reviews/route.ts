// ============================================================
// GET  /api/products/[slug]/reviews — 리뷰 목록 + 평점 요약 (공개)
// POST /api/products/[slug]/reviews — 리뷰 작성 (구매 확정 회원만)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 10;
const REVIEWABLE_STATUSES = ["delivered", "confirmed"];

async function getProductIdBySlug(productSlug: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("slug", productSlug)
    .eq("is_active", true)
    .single();
  return data?.id ?? null;
}

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

// ── GET ──────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const productId = await getProductIdBySlug(slug);
    if (!productId) {
      return Response.json({ success: false, error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor"); // created_at of last item on previous page

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("product_reviews")
      .select("id, product_id, master_user_id, order_id, rating, body, images, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (cursor) query = query.lt("created_at", cursor);

    const { data: rows, error } = await query;
    if (error) throw error;

    const hasMore = (rows?.length ?? 0) > PAGE_SIZE;
    const pageRows = (rows ?? []).slice(0, PAGE_SIZE);

    const { data: ratingRows, error: ratingError } = await supabase
      .from("product_reviews")
      .select("rating")
      .eq("product_id", productId);
    if (ratingError) throw ratingError;

    const count = ratingRows?.length ?? 0;
    const average = count > 0
      ? Math.round((ratingRows!.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
      : 0;

    return Response.json({
      success: true,
      data: {
        reviews: pageRows.map((r) => ({
          id: r.id,
          productId: r.product_id,
          masterUserId: r.master_user_id,
          orderId: r.order_id,
          rating: r.rating,
          body: r.body,
          images: r.images ?? [],
          createdAt: r.created_at,
        })),
        summary: { average, count },
        nextCursor: hasMore ? pageRows[pageRows.length - 1]?.created_at ?? null : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/products/[slug]/reviews] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ── POST ─────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { slug } = await params;
    const productId = await getProductIdBySlug(slug);
    if (!productId) {
      return Response.json({ success: false, error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const rating = Number(body.rating);
    const reviewBody = String(body.body ?? "").trim();
    const images = Array.isArray(body.images) ? body.images.slice(0, 5) : [];

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ success: false, error: "별점은 1~5 사이여야 합니다." }, { status: 400 });
    }
    if (!reviewBody || reviewBody.length > 2000) {
      return Response.json({ success: false, error: "리뷰 내용을 1~2000자로 입력해주세요." }, { status: 400 });
    }
    if (!images.every((img: unknown) => typeof img === "string" && /^https?:\/\//.test(img))) {
      return Response.json({ success: false, error: "이미지 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 이 상품을 배송완료/구매확정 상태로 받은 주문 중, 아직 리뷰를 쓰지 않은 것을 찾는다.
    const { data: eligibleItems, error: itemsError } = await admin
      .from("order_items")
      .select("order_id, orders!inner(id, master_user_id, status, created_at)")
      .eq("product_id", productId)
      .eq("orders.master_user_id", masterUserId)
      .in("orders.status", REVIEWABLE_STATUSES);
    if (itemsError) throw itemsError;

    const candidateOrderIds = [...new Set((eligibleItems ?? []).map((r) => r.order_id))];
    if (candidateOrderIds.length === 0) {
      return Response.json(
        { success: false, error: "배송이 완료된 구매 건에 대해서만 리뷰를 작성할 수 있습니다." },
        { status: 403 }
      );
    }

    const { data: existingReviews, error: existingError } = await admin
      .from("product_reviews")
      .select("order_id")
      .eq("product_id", productId)
      .in("order_id", candidateOrderIds);
    if (existingError) throw existingError;

    const reviewedOrderIds = new Set((existingReviews ?? []).map((r) => r.order_id));
    const targetOrderId = candidateOrderIds.find((id) => !reviewedOrderIds.has(id));

    if (!targetOrderId) {
      return Response.json(
        { success: false, error: "이미 이 상품에 대한 리뷰를 작성하셨습니다." },
        { status: 409 }
      );
    }

    const { data: review, error: insertError } = await admin
      .from("product_reviews")
      .insert({
        product_id: productId,
        master_user_id: masterUserId,
        order_id: targetOrderId,
        rating,
        body: reviewBody,
        images: images.map((url: string) => ({ url })),
      })
      .select()
      .single();
    if (insertError) throw insertError;

    return Response.json({ success: true, data: review }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products/[slug]/reviews] Error:", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

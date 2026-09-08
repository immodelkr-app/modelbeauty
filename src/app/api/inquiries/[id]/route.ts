// ============================================================
// GET /api/inquiries/[id] — 내 문의 단건 상세 (본인 소유만, 로그인 필요)
// ============================================================

import { createSupabaseServerClient, createSupabaseAdmin } from "@/lib/supabase/server";

async function getAuthenticatedMasterUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.user_metadata?.master_user_id as string | undefined) ?? user.id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const masterUserId = await getAuthenticatedMasterUserId();
    if (!masterUserId) {
      return Response.json({ success: false, error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;
    const admin = createSupabaseAdmin();

    const { data: r, error } = await admin
      .from("inquiries")
      .select(
        `id, category, product_id, title, body, images, is_private, status, answer, answered_at, created_at,
         products ( id, name, slug, images )`
      )
      .eq("id", id)
      .eq("master_user_id", masterUserId)
      .single();

    if (error || !r) {
      return Response.json({ success: false, error: "문의를 찾을 수 없습니다." }, { status: 404 });
    }

    const product = Array.isArray(r.products) ? r.products[0] : r.products;

    return Response.json({
      success: true,
      data: {
        id: r.id,
        category: r.category,
        title: r.title,
        body: r.body,
        images: r.images ?? [],
        isPrivate: r.is_private,
        status: r.status,
        answer: r.answer,
        answeredAt: r.answered_at,
        createdAt: r.created_at,
        product: product ? { id: product.id, name: product.name, slug: product.slug, images: product.images ?? [] } : null,
      },
    });
  } catch (err) {
    console.error("[GET /api/inquiries/[id]]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

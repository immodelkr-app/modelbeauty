// ============================================================
// GET /api/admin/inquiries — 전체 문의 목록 (카테고리/상태 필터, 관리자 전용)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const CATEGORIES = ["product", "trial", "app", "etc"] as const;
const STATUSES = ["pending", "answered"] as const;

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const admin = createSupabaseAdmin();
    let query = admin
      .from("inquiries")
      .select(
        `id, master_user_id, category, product_id, title, body, images, is_private, status, answer, answered_at, created_at,
         products ( id, name, slug )`
      )
      .order("created_at", { ascending: false });

    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      query = query.eq("category", category);
    }
    if (status && (STATUSES as readonly string[]).includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((r) => {
      const product = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        id: r.id,
        masterUserId: r.master_user_id,
        category: r.category,
        title: r.title,
        body: r.body,
        images: r.images ?? [],
        isPrivate: r.is_private,
        status: r.status,
        answer: r.answer,
        answeredAt: r.answered_at,
        createdAt: r.created_at,
        product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
      };
    });

    return Response.json({ success: true, data: items });
  } catch (err) {
    console.error("[GET /api/admin/inquiries]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

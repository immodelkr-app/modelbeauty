// ============================================================
// GET  /api/admin/categories — 카테고리 목록
// POST /api/admin/categories — 카테고리 등록 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return Response.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/categories]", err);
    return Response.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 관리자 권한 검증
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const { name, slug, parentId, sortOrder, imageUrl, isActive } = body;

    if (!name || !slug) {
      return Response.json(
        { success: false, error: "name과 slug는 필수입니다." },
        { status: 400 }
      );
    }

    // slug 형식 검증: 소문자, 숫자, 하이픈만 허용
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return Response.json(
        { success: false, error: "slug는 소문자, 숫자, 하이픈(-)만 사용 가능합니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("categories")
      .insert({
        name,
        slug,
        parent_id: parentId ?? null,
        sort_order: sortOrder ?? 0,
        image_url: imageUrl ?? null,
        is_active: isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json(
          { success: false, error: "이미 사용 중인 slug입니다." },
          { status: 409 }
        );
      }
      console.error("[POST /api/admin/categories] Supabase error:", error);
      return Response.json(
        { success: false, error: "카테고리 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        data: {
          id: data.id,
          name: data.name,
          slug: data.slug,
          parentId: data.parent_id,
          sortOrder: data.sort_order,
          imageUrl: data.image_url,
          isActive: data.is_active,
          createdAt: data.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/categories] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

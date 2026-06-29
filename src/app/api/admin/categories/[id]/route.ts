// ============================================================
// PATCH /api/admin/categories/[id] — 카테고리 수정 (Admin Only)
// DELETE /api/admin/categories/[id] — 카테고리 삭제 (Admin Only)
// ============================================================

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, parentId, sortOrder, imageUrl, isActive } = body;

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json(
        { success: false, error: "slug는 소문자, 숫자, 하이픈(-)만 사용 가능합니다." },
        { status: 400 }
      );
    }

    // 업데이트할 필드만 포함
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (slug !== undefined) updatePayload.slug = slug;
    if (parentId !== undefined) updatePayload.parent_id = parentId;
    if (sortOrder !== undefined) updatePayload.sort_order = sortOrder;
    if (imageUrl !== undefined) updatePayload.image_url = imageUrl;
    if (isActive !== undefined) updatePayload.is_active = isActive;

    if (Object.keys(updatePayload).length === 0) {
      return Response.json(
        { success: false, error: "수정할 항목이 없습니다." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("categories")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json(
          { success: false, error: "카테고리를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      if (error.code === "23505") {
        return Response.json(
          { success: false, error: "이미 사용 중인 slug입니다." },
          { status: 409 }
        );
      }
      console.error("[PATCH /api/admin/categories/[id]] Supabase error:", error);
      return Response.json(
        { success: false, error: "카테고리 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return Response.json({
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
    });
  } catch (err) {
    console.error("[PATCH /api/admin/categories/[id]] Unexpected error:", err);
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

    const { error } = await admin.from("categories").delete().eq("id", id);

    if (error) {
      if (error.code === "PGRST116") {
        return Response.json(
          { success: false, error: "카테고리를 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      console.error("[DELETE /api/admin/categories/[id]] Supabase error:", error);
      return Response.json(
        { success: false, error: "카테고리 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: "카테고리가 삭제되었습니다." });
  } catch (err) {
    console.error("[DELETE /api/admin/categories/[id]] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/categories — 활성화된 카테고리 목록 조회
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("[GET /api/categories] Supabase error:", error);
      return Response.json(
        { success: false, error: "카테고리 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    // snake_case → camelCase 변환
    const categories = (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parent_id,
      sortOrder: c.sort_order,
      imageUrl: c.image_url,
      isActive: c.is_active,
      createdAt: c.created_at,
    }));

    return Response.json({ success: true, data: categories });
  } catch (err) {
    console.error("[GET /api/categories] Unexpected error:", err);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/reviews — 전체 리뷰 목록 (숨김 포함)
 */
export async function GET(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { searchParams } = new URL(request.url);
    const onlyHidden = searchParams.get("hidden") === "true";

    const admin = createSupabaseAdmin();
    let query = admin
      .from("product_reviews")
      .select("*, products(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (onlyHidden) query = query.eq("is_hidden", true);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/reviews]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

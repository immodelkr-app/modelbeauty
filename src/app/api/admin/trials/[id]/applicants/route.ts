import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/trials/[id]/applicants — 캠페인 신청자 목록
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("trial_applications")
      .select("*")
      .eq("campaign_id", id)
      .order("applied_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/trials/[id]/applicants]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

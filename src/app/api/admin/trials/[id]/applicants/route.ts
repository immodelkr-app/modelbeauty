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

    const applicationIds = (data ?? []).map((a) => a.id);
    const { data: reviewedRows } = applicationIds.length
      ? await admin.from("trial_reviews").select("trial_application_id").in("trial_application_id", applicationIds)
      : { data: [] as { trial_application_id: string }[] };
    const reviewedSet = new Set((reviewedRows ?? []).map((r) => r.trial_application_id));

    const result = (data ?? []).map((a) => ({ ...a, has_review: reviewedSet.has(a.id) }));

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[GET /api/admin/trials/[id]/applicants]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

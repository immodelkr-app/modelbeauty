import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/trials — 전체 체험단 캠페인 목록
 */
export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data: campaigns, error } = await admin
      .from("trial_campaigns")
      .select("*, products(name, slug)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (campaigns ?? []).map((c) => c.id);
    const { data: applications } = ids.length
      ? await admin.from("trial_applications").select("campaign_id").in("campaign_id", ids)
      : { data: [] as { campaign_id: string }[] };

    const countByCampaign = new Map<string, number>();
    for (const a of applications ?? []) {
      countByCampaign.set(a.campaign_id, (countByCampaign.get(a.campaign_id) ?? 0) + 1);
    }

    const data = (campaigns ?? []).map((c) => ({ ...c, applicant_count: countByCampaign.get(c.id) ?? 0 }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[GET /api/admin/trials]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/trials — 체험단 캠페인 개설
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      productId,
      vendorId,
      title,
      description,
      content,
      campaignType = "free",
      price = 0,
      quota,
      recruitStart,
      recruitEnd,
      status = "draft",
    } = body;

    if (!productId || !title?.trim() || !quota || !recruitStart || !recruitEnd) {
      return NextResponse.json({ success: false, error: "상품, 제목, 정원, 모집 기간은 필수입니다." }, { status: 400 });
    }
    if (!["free", "paid"].includes(campaignType)) {
      return NextResponse.json({ success: false, error: "캠페인 유형은 free 또는 paid여야 합니다." }, { status: 400 });
    }
    if (new Date(recruitEnd) <= new Date(recruitStart)) {
      return NextResponse.json({ success: false, error: "모집 종료일은 시작일보다 이후여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("trial_campaigns")
      .insert({
        product_id: productId,
        vendor_id: vendorId || null,
        title: title.trim(),
        description: description?.trim() || null,
        content: content || null,
        campaign_type: campaignType,
        price: campaignType === "paid" ? Number(price) : 0,
        quota: Number(quota),
        recruit_start: recruitStart,
        recruit_end: recruitEnd,
        status,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/trials]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

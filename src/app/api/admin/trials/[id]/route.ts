import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/trials/[id] — 체험단 캠페인 수정 (상태 전환 포함)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, unknown> = {};

    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.description !== undefined) update.description = body.description?.trim() || null;
    if (body.campaignType !== undefined) update.campaign_type = body.campaignType;
    if (body.price !== undefined) update.price = Number(body.price);
    if (body.quota !== undefined) update.quota = Number(body.quota);
    if (body.recruitStart !== undefined) update.recruit_start = body.recruitStart;
    if (body.recruitEnd !== undefined) update.recruit_end = body.recruitEnd;
    if (body.status !== undefined) {
      if (!["draft", "recruiting", "selecting", "closed"].includes(body.status)) {
        return NextResponse.json({ success: false, error: "유효하지 않은 상태입니다." }, { status: 400 });
      }
      update.status = body.status;
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("trial_campaigns")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[PATCH /api/admin/trials/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/trials/[id] — 체험단 캠페인 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id } = await params;
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("trial_campaigns").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/trials/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

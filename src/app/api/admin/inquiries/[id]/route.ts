// ============================================================
// PATCH  /api/admin/inquiries/[id] — 답변 등록/수정 (관리자 전용)
// DELETE /api/admin/inquiries/[id] — 문의 삭제 (관리자 전용)
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
    const { answer } = body as { answer?: string };

    if (!answer?.trim()) {
      return Response.json({ success: false, error: "답변 내용을 입력해주세요." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("inquiries")
      .update({ answer: answer.trim(), status: "answered", answered_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return Response.json({ success: false, error: "문의를 찾을 수 없습니다." }, { status: 404 });
    }

    return Response.json({ success: true, message: "답변이 등록되었습니다." });
  } catch (err) {
    console.error("[PATCH /api/admin/inquiries/[id]]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
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
    const { error } = await admin.from("inquiries").delete().eq("id", id);
    if (error) throw error;

    return Response.json({ success: true, message: "삭제되었습니다." });
  } catch (err) {
    console.error("[DELETE /api/admin/inquiries/[id]]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

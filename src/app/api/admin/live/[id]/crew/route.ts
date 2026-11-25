// ============================================================
// PUT /api/admin/live/[id]/crew — 기존 방송의 담당 크루/수수료율 지정·변경·해제
// body: { crewId: string | null, commissionRate: number }
// 방송당 크루 1명 기준(등록 화면과 동일) — 기존 매핑을 지우고 새로 저장한다.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const { id: streamId } = await params;
    const { crewId, commissionRate } = await request.json();
    const rate = Number(commissionRate);

    if (crewId !== null && typeof crewId !== "string") {
      return NextResponse.json({ success: false, error: "crewId가 올바르지 않습니다." }, { status: 400 });
    }
    if (crewId && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      return NextResponse.json({ success: false, error: "수수료율은 0~100 사이여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { error: delErr } = await admin.from("live_stream_crews").delete().eq("stream_id", streamId);
    if (delErr) throw delErr;

    if (crewId) {
      const { error: insErr } = await admin
        .from("live_stream_crews")
        .insert({ stream_id: streamId, crew_id: crewId, commission_rate: rate });
      if (insErr) throw insErr;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/admin/live/[id]/crew]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

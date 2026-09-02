import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

const STATUS_LABEL: Record<string, string> = {
  applied: "심사중",
  selected: "선정됨",
  rejected: "반려됨",
};

/**
 * GET /api/admin/trials/[id]/applicants/excel-download — 캠페인 신청자 목록 엑셀 다운로드
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

    const { data: campaign } = await admin
      .from("trial_campaigns")
      .select("title")
      .eq("id", id)
      .single();

    const { data: applicants, error } = await admin
      .from("trial_applications")
      .select("*")
      .eq("campaign_id", id)
      .order("applied_at", { ascending: true });

    if (error) throw error;

    const excelRows = (applicants ?? []).map((a) => ({
      "이름": a.applicant_name ?? "",
      "연락처": a.applicant_phone ?? "",
      "우편번호": a.address_zipcode ?? "",
      "기본주소": a.address_main ?? "",
      "상세주소": a.address_detail ?? "",
      "유튜브 채널": a.youtube_channel ?? "",
      "인스타그램 아이디": a.instagram_id ?? "",
      "기타 링크": a.channel_url ?? "",
      "지원 동기": a.message ?? "",
      "상태": STATUS_LABEL[a.status] ?? a.status,
      "신청일시": new Date(a.applied_at).toLocaleString("ko-KR"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "체험단신청자");

    worksheet["!cols"] = [
      { wch: 12 }, // 이름
      { wch: 15 }, // 연락처
      { wch: 10 }, // 우편번호
      { wch: 35 }, // 기본주소
      { wch: 20 }, // 상세주소
      { wch: 28 }, // 유튜브 채널
      { wch: 20 }, // 인스타그램 아이디
      { wch: 28 }, // 기타 링크
      { wch: 30 }, // 지원 동기
      { wch: 10 }, // 상태
      { wch: 18 }, // 신청일시
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const safeTitle = (campaign?.title ?? "trial").replace(/[^\w가-힣-]/g, "_");
    const filename = `${safeTitle}_신청자_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="trial_applicants.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/trials/[id]/applicants/excel-download]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

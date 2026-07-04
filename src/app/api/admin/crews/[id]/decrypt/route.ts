import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { decryptText } from "@/lib/encryption";

/**
 * POST /api/admin/crews/[id]/decrypt - 민감 정보 복호화 조회
 * (관리자 권한 확인 후 안전하게 복호화된 값 반환)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { id } = await params;

  try {
    const admin = createSupabaseAdmin();
    const { data: crew, error } = await admin
      .from("live_crews")
      .select("resident_registration_number, account_number")
      .eq("id", id)
      .single();

    if (error || !crew) {
      console.error("[POST /api/admin/crews/[id]/decrypt] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const decryptedRrn = decryptText(crew.resident_registration_number);
    const decryptedAcc = decryptText(crew.account_number);

    return NextResponse.json({
      success: true,
      data: {
        residentRegistrationNumber: decryptedRrn,
        accountNumber: decryptedAcc,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/crews/[id]/decrypt]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

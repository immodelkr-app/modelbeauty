import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { encryptText, decryptText, maskResidentNumber, maskAccountNumber } from "@/lib/encryption";

/**
 * GET /api/admin/crews - 크루 목록 조회
 * (주민번호, 계좌번호는 마스킹 처리되어 반환)
 */
export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data: crews, error } = await admin
      .from("live_crews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/crews] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 목록을 조회할 수 없습니다." }, { status: 500 });
    }

    const maskedCrews = (crews ?? []).map((crew: any) => {
      let rrnPlain = "";
      let accPlain = "";
      try {
        rrnPlain = decryptText(crew.resident_registration_number);
        accPlain = decryptText(crew.account_number);
      } catch (err) {
        console.error("Decryption error:", err);
      }

      return {
        ...crew,
        resident_registration_number: maskResidentNumber(rrnPlain),
        account_number: maskAccountNumber(accPlain),
      };
    });

    return NextResponse.json({ success: true, data: maskedCrews });
  } catch (error) {
    console.error("[GET /api/admin/crews]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/crews - 신규 크루 등록
 * (주민번호, 계좌번호 암호화 후 저장)
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      name,
      nickname,
      phone,
      residentRegistrationNumber, // Plain text
      bankName,
      accountNumber,              // Plain text
      defaultCommissionRate = 0,
    } = body;

    if (!name || !nickname || !phone || !residentRegistrationNumber || !bankName || !accountNumber) {
      return NextResponse.json({ success: false, error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    // 민감 정보 암호화
    const encryptedRRN = encryptText(residentRegistrationNumber.trim());
    const encryptedAcc = encryptText(accountNumber.trim());

    const admin = createSupabaseAdmin();
    const { data: crew, error } = await admin
      .from("live_crews")
      .insert({
        name: name.trim(),
        nickname: nickname.trim(),
        phone: phone.trim(),
        resident_registration_number: encryptedRRN,
        bank_name: bankName.trim(),
        account_number: encryptedAcc,
        default_commission_rate: Number(defaultCommissionRate),
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/crews] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 등록에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: crew });
  } catch (error) {
    console.error("[POST /api/admin/crews]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

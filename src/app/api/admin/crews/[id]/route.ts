import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { encryptText } from "@/lib/encryption";

/**
 * PUT /api/admin/crews/[id] - 크루 정보 수정
 * (수정된 민감 정보는 암호화하여 저장)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name,
      nickname,
      phone,
      residentRegistrationNumber, // Plain text
      bankName,
      accountNumber,              // Plain text
      defaultCommissionRate,
    } = body;

    const updateData: Record<string, any> = {};
    if (name) updateData.name = name.trim();
    if (nickname) updateData.nickname = nickname.trim();
    if (phone) updateData.phone = phone.trim();
    if (bankName) updateData.bank_name = bankName.trim();
    if (defaultCommissionRate !== undefined) {
      updateData.default_commission_rate = Number(defaultCommissionRate);
    }

    // 마스킹 처리된 값("*")이 아니면서 새로 입력된 경우에만 암호화하여 갱신
    if (residentRegistrationNumber && !residentRegistrationNumber.includes("*")) {
      updateData.resident_registration_number = encryptText(residentRegistrationNumber.trim());
    }
    if (accountNumber && !accountNumber.includes("*")) {
      updateData.account_number = encryptText(accountNumber.trim());
    }

    const admin = createSupabaseAdmin();
    const { data: crew, error } = await admin
      .from("live_crews")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT /api/admin/crews/[id]] DB Error:", error);
      return NextResponse.json({ success: false, error: "크루 정보 수정에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: crew });
  } catch (error) {
    console.error("[PUT /api/admin/crews/[id]]", error);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/vendors — 업체 목록 조회
 */
export async function GET() {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/admin/vendors]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/admin/vendors — 업체 등록
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const body = await request.json();
    const {
      name,
      businessNumber,
      representativeName,
      contactName,
      contactPhone,
      contactEmail,
      bankName,
      accountNumber,
      accountHolder,
      defaultCostType = "rate",
      defaultCostRate = 0,
      defaultCostPrice = 0,
      note,
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "업체명은 필수입니다." }, { status: 400 });
    }
    if (!["rate", "fixed"].includes(defaultCostType)) {
      return NextResponse.json({ success: false, error: "공급 방식은 rate 또는 fixed여야 합니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("vendors")
      .insert({
        name: name.trim(),
        business_number: businessNumber?.trim() || null,
        representative_name: representativeName?.trim() || null,
        contact_name: contactName?.trim() || null,
        contact_phone: contactPhone?.trim() || null,
        contact_email: contactEmail?.trim() || null,
        bank_name: bankName?.trim() || null,
        account_number: accountNumber?.trim() || null,
        account_holder: accountHolder?.trim() || null,
        default_cost_type: defaultCostType,
        default_cost_rate: Number(defaultCostRate),
        default_cost_price: Number(defaultCostPrice),
        note: note?.trim() || null,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/vendors]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * PUT /api/admin/vendors/[id] — 업체 수정
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
      businessNumber,
      representativeName,
      contactName,
      contactPhone,
      contactEmail,
      bankName,
      accountNumber,
      accountHolder,
      defaultCostType,
      defaultCostRate,
      defaultCostPrice,
      note,
      isActive,
    } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (businessNumber !== undefined) updateData.business_number = businessNumber?.trim() || null;
    if (representativeName !== undefined) updateData.representative_name = representativeName?.trim() || null;
    if (contactName !== undefined) updateData.contact_name = contactName?.trim() || null;
    if (contactPhone !== undefined) updateData.contact_phone = contactPhone?.trim() || null;
    if (contactEmail !== undefined) updateData.contact_email = contactEmail?.trim() || null;
    if (bankName !== undefined) updateData.bank_name = bankName?.trim() || null;
    if (accountNumber !== undefined) updateData.account_number = accountNumber?.trim() || null;
    if (accountHolder !== undefined) updateData.account_holder = accountHolder?.trim() || null;
    if (defaultCostType !== undefined) updateData.default_cost_type = defaultCostType;
    if (defaultCostRate !== undefined) updateData.default_cost_rate = Number(defaultCostRate);
    if (defaultCostPrice !== undefined) updateData.default_cost_price = Number(defaultCostPrice);
    if (note !== undefined) updateData.note = note?.trim() || null;
    if (isActive !== undefined) updateData.is_active = isActive;
    updateData.updated_at = new Date().toISOString();

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("vendors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[PUT /api/admin/vendors/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/vendors/[id] — 업체 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const { id } = await params;

  try {
    const admin = createSupabaseAdmin();

    // 연결된 상품 수 확인
    const { count } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { success: false, error: `이 업체에 연결된 상품이 ${count}개 있습니다. 상품의 업체 연결을 먼저 해제해 주세요.` },
        { status: 409 }
      );
    }

    const { error } = await admin.from("vendors").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/vendors/[id]]", err);
    return NextResponse.json({ success: false, error: "서버 오류" }, { status: 500 });
  }
}

import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CARRIER_CODES } from "@/lib/sweettracker";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ success: false, error: "파일이 업로드되지 않았습니다." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 엑셀 파싱
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

    if (excelRows.length === 0) {
      return Response.json({ success: false, error: "엑셀 데이터가 비어 있습니다." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    let successCount = 0;
    const errors: { row: number; orderNumber?: string; reason: string }[] = [];

    // 데이터 추출 및 DB 반영 처리
    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      const rowIndex = i + 2; // Excel 엑셀 시트 1-indexed 및 헤더 행 고려하여 2부터 시작

      // 다양한 컬럼 헤더 이름 지원 (한글/영문 대응)
      const orderId = (row["주문ID"] ?? row["주문 ID"] ?? row["orderId"] ?? row["id"])?.toString().trim();
      const orderNumber = (row["주문번호"] ?? row["주문 번호"] ?? row["orderNumber"] ?? row["order_number"])?.toString().trim();
      const carrierCode = (row["택배사코드"] ?? row["택배사 코드"] ?? row["carrierCode"] ?? row["carrier_code"])?.toString().trim();
      const trackingNumber = (row["운송장번호"] ?? row["운송장 번호"] ?? row["trackingNumber"] ?? row["tracking_number"])?.toString().trim();

      // 필수값 검증
      if (!orderId) {
        errors.push({ row: rowIndex, orderNumber, reason: "주문ID가 누락되었습니다." });
        continue;
      }
      if (!carrierCode) {
        errors.push({ row: rowIndex, orderNumber, reason: "택배사코드가 누락되었습니다." });
        continue;
      }
      if (!trackingNumber) {
        errors.push({ row: rowIndex, orderNumber, reason: "운송장번호가 누락되었습니다." });
        continue;
      }

      // 택배사 코드 검증
      const carrierName = CARRIER_CODES[carrierCode];
      if (!carrierName) {
        errors.push({ row: rowIndex, orderNumber, reason: `알 수 없는 택배사코드 (${carrierCode}) 입니다.` });
        continue;
      }

      try {
        // 주문 확인
        const { data: order, error: orderErr } = await admin
          .from("orders")
          .select("id, status, order_number")
          .eq("id", orderId)
          .single();

        if (orderErr || !order) {
          errors.push({ row: rowIndex, orderNumber: orderNumber ?? orderId, reason: "해당 주문을 DB에서 찾을 수 없습니다." });
          continue;
        }

        // 1. 배송 정보 저장 (shipping_info upsert)
        const { error: shipErr } = await admin
          .from("shipping_info")
          .upsert({
            order_id: orderId,
            carrier_code: carrierCode,
            carrier_name: carrierName,
            tracking_number: trackingNumber,
            tracking_url: null,
            shipped_at: new Date().toISOString(),
          });

        if (shipErr) {
          errors.push({ row: rowIndex, orderNumber: order.order_number, reason: `배송 정보 등록 실패: ${shipErr.message}` });
          continue;
        }

        // 2. 주문 상태를 'shipping'으로 변경 (paid / preparing 인 경우)
        if (order.status === "paid" || order.status === "preparing") {
          const { error: updateErr } = await admin
            .from("orders")
            .update({ status: "shipping", updated_at: new Date().toISOString() })
            .eq("id", orderId);

          if (updateErr) {
            errors.push({ row: rowIndex, orderNumber: order.order_number, reason: `주문 상태 업데이트 실패: ${updateErr.message}` });
            continue;
          }

          // 상태 변경 히스토리 기록
          await admin.from("order_status_history").insert({
            order_id: orderId,
            from_status: order.status,
            to_status: "shipping",
            changed_by: "admin",
            note: `배송 일괄 등록(엑셀 업로드): ${carrierName} ${trackingNumber}`,
          });
        }

        successCount++;
      } catch (err: any) {
        console.error(`[bulk-upload] 행 ${rowIndex} 처리 오류:`, err);
        errors.push({ row: rowIndex, orderNumber, reason: "DB 연동 도중 에러가 발생했습니다." });
      }
    }

    return Response.json({
      success: true,
      summary: {
        total: excelRows.length,
        success: successCount,
        failed: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[POST /api/admin/shipping/bulk-upload]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

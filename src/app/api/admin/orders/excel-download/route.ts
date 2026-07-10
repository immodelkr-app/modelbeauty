import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const url = new URL(request.url);
    const orderIdsStr = url.searchParams.get("orderIds") ?? "";
    const status = url.searchParams.get("status") ?? "";

    const admin = createSupabaseAdmin();
    let query = admin
      .from("orders")
      .select(`
        id,
        order_number,
        recipient_name,
        recipient_phone,
        address_zipcode,
        address_main,
        address_detail,
        delivery_memo,
        status,
        order_items (
          product_name,
          variant_info,
          quantity
        )
      `)
      .order("created_at", { ascending: false });

    // orderIds가 명시된 경우 우선 필터링
    if (orderIdsStr) {
      const orderIds = orderIdsStr.split(",").map((id) => id.trim()).filter(Boolean);
      if (orderIds.length > 0) {
        query = query.in("id", orderIds);
      }
    } else if (status) {
      // 그렇지 않고 상태 필터가 있으면 적용
      query = query.eq("status", status);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    // 엑셀 데이터용 JSON 배열 생성
    const excelRows = (orders ?? []).map((o) => {
      const items = (o.order_items as any[]) ?? [];
      
      // 상품정보 문자열 포맷팅: 상품명(옵션/수량), 상품명2(옵션/수량)
      const productSummary = items
        .map((item) => {
          const optStr = item.variant_info
            ? `(${Object.values(item.variant_info).join("/")})`
            : "";
          return `${item.product_name}${optStr} x ${item.quantity}`;
        })
        .join(", ");

      const totalQty = items.reduce((acc, curr) => acc + (curr.quantity ?? 0), 0);

      return {
        "주문ID": o.id,
        "주문번호": o.order_number,
        "수령인명": o.recipient_name,
        "수령인연락처": o.recipient_phone,
        "우편번호": o.address_zipcode,
        "기본주소": o.address_main,
        "상세주소": o.address_detail ?? "",
        "배송메모": o.delivery_memo ?? "",
        "상품정보": productSummary,
        "총수량": totalQty,
        "주문상태": o.status
      };
    });

    // XLSX 워크북 제작
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "주문배송정보");

    // 컬럼 넓이 지정 (보기 좋게 조정)
    const colWidths = [
      { wch: 38 }, // 주문ID
      { wch: 20 }, // 주문번호
      { wch: 12 }, // 수령인명
      { wch: 15 }, // 수령인연락처
      { wch: 10 }, // 우편번호
      { wch: 35 }, // 기본주소
      { wch: 20 }, // 상세주소
      { wch: 25 }, // 배송메모
      { wch: 45 }, // 상품정보
      { wch: 8 },  // 총수량
      { wch: 12 }  // 주문상태
    ];
    worksheet["!cols"] = colWidths;

    // 바이너리 버퍼 생성 (xlsx 모듈의 write 방식 적용)
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // 헤더 설정 및Response 전송
    const filename = `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/orders/excel-download]", err);
    return Response.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

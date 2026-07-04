import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-admin";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { parseCSV, generateSlug } from "@/lib/csv";

/**
 * POST /api/admin/products/import - 상품 CSV 대량 업로드
 */
export async function POST(request: NextRequest) {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "업로드된 파일이 없습니다." }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      return NextResponse.json({ success: false, error: "등록할 상품 데이터가 없습니다. (헤더 행 외에 최소 1개 행이 필요합니다)" }, { status: 400 });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // 헤더 인덱스 맵 구성 (한글 매핑 지원)
    // 필수/선택 열: 상품명, 슬러그, 카테고리명, 기본가격, 판매가격, 재고수량, SKU, 상세설명, 태그, 활성화여부, 추천여부
    const colMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const cleanH = h.trim();
      colMap[cleanH] = idx;
    });

    const getVal = (row: string[], name: string, fallback = ""): string => {
      const idx = colMap[name];
      if (idx === undefined || row[idx] === undefined) return fallback;
      return row[idx].trim();
    };

    const admin = createSupabaseAdmin();
    
    // 1. 기존 카테고리 정보 조회 (카테고리명 -> ID 맵 구축)
    const { data: categories, error: catFetchError } = await admin
      .from("categories")
      .select("id, name");

    if (catFetchError) {
      console.error("Failed to fetch categories:", catFetchError);
    }

    const categoryMap: Record<string, string> = {};
    (categories ?? []).forEach((c) => {
      categoryMap[c.name.trim()] = c.id;
    });

    const successList: string[] = [];
    const failureList: { row: number; name: string; reason: string }[] = [];

    // 2. 행 단위로 상품 순회 처리
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 헤더 제외 1-based index (헤더=1, 첫데이터=2)

      const name = getVal(row, "상품명");
      let slug = getVal(row, "슬러그");
      const categoryName = getVal(row, "카테고리명");
      const basePriceStr = getVal(row, "기본가격");
      const salePriceStr = getVal(row, "판매가격");
      const stockQuantityStr = getVal(row, "재고수량");
      const sku = getVal(row, "SKU");
      const description = getVal(row, "상세설명");
      const tagsStr = getVal(row, "태그");
      const isActiveStr = getVal(row, "활성화여부");
      const isFeaturedStr = getVal(row, "추천여부");

      // 필수 항목 체크
      if (!name) {
        failureList.push({ row: rowNum, name: "이름 누락", reason: "'상품명'은 필수 입력 항목입니다." });
        continue;
      }

      if (!basePriceStr || isNaN(Number(basePriceStr)) || Number(basePriceStr) < 0) {
        failureList.push({ row: rowNum, name, reason: `'기본가격'이 올바르지 않습니다: ${basePriceStr}` });
        continue;
      }

      const basePrice = Math.floor(Number(basePriceStr));
      const salePrice = salePriceStr && !isNaN(Number(salePriceStr)) ? Math.floor(Number(salePriceStr)) : null;
      const stockQuantity = stockQuantityStr && !isNaN(Number(stockQuantityStr)) ? Math.floor(Number(stockQuantityStr)) : 0;

      // 슬러그(Slug) 자동 처리
      if (!slug) {
        slug = generateSlug(name);
      } else {
        // 소문자 및 하이픈 정규화
        slug = slug.toLowerCase().replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣-]/g, "").replace(/\s+/g, "-");
      }

      // 카테고리 없으면 자동 신규 생성
      let categoryId = null;
      if (categoryName) {
        const trimmedCat = categoryName.trim();
        if (categoryMap[trimmedCat]) {
          categoryId = categoryMap[trimmedCat];
        } else {
          // 카테고리 신규 추가
          const catSlug = generateSlug(trimmedCat);
          const { data: newCat, error: catCreateError } = await admin
            .from("categories")
            .insert({
              name: trimmedCat,
              slug: catSlug,
              is_active: true
            })
            .select("id")
            .single();

          if (catCreateError) {
            console.error(`Failed to auto-create category [${trimmedCat}]:`, catCreateError);
          } else if (newCat) {
            categoryId = newCat.id;
            categoryMap[trimmedCat] = newCat.id; // 다음 행을 위해 캐시 갱신
          }
        }
      }

      // 태그 파싱
      let tags: string[] = [];
      if (tagsStr) {
        tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
      }

      const isActive = !(isActiveStr === "N" || isActiveStr === "n" || isActiveStr === "FALSE" || isActiveStr === "false");
      const isFeatured = isFeaturedStr === "Y" || isFeaturedStr === "y" || isFeaturedStr === "TRUE" || isFeaturedStr === "true";

      // 상품 테이블 인서트
      const { error: insertError } = await admin
        .from("products")
        .insert({
          name,
          slug,
          category_id: categoryId,
          description: description || null,
          base_price: basePrice,
          sale_price: salePrice,
          stock_quantity: stockQuantity,
          sku: sku || null,
          tags,
          is_active: isActive,
          is_featured: isFeatured,
        });

      if (insertError) {
        console.error(`Row ${rowNum} insert error:`, insertError);
        let reason = "DB 처리 도중 알 수 없는 에러가 발생했습니다.";
        if (insertError.code === "23505") {
          reason = "이미 데이터베이스에 존재하는 '슬러그(Slug)' 또는 'SKU'입니다.";
        }
        failureList.push({ row: rowNum, name, reason });
      } else {
        successList.push(name);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount: successList.length,
        failureCount: failureList.length,
        failures: failureList,
      }
    });

  } catch (error) {
    console.error("[POST /api/admin/products/import]", error);
    return NextResponse.json({ success: false, error: "대량 등록 처리 도중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

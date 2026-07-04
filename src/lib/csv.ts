/**
 * RFC 4180 규격을 따르는 경량 CSV 파서
 * 쌍따옴표 내부에 쉼표(,), 개행문자(\n), 이중 따옴표("")가 포함된 셀 데이터를 손실 없이 분리합니다.
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // 이중 따옴표 탈출문자("") 처리
        cell += '"';
        i++; // 다음 따옴표 스킵
      } else {
        // 따옴표 상태 토글
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // \r\n 개행인 경우 \n 스킵
      }
      row.push(cell.trim());
      result.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // 마지막 행 및 셀 처리
  if (row.length > 0 || cell !== "") {
    row.push(cell.trim());
    result.push(row);
  }

  // 완전히 비어있는 행 필터링
  return result.filter((r) => r.length > 0 && r.some((c) => c !== ""));
}

/**
 * 상품명으로부터 안전하고 고유한 URL 친화적인 슬러그(Slug)를 자동 생성합니다.
 */
export function generateSlug(name: string): string {
  let slug = name.toLowerCase().trim();

  // 공백 및 언더바를 하이픈(-)으로 변경
  slug = slug.replace(/[\s_]+/g, "-");

  // 영문, 한글, 숫자, 하이픈(-)만 남기고 특수문자 제거
  slug = slug.replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣-]/g, "");

  // 연속된 하이픈 단일화
  slug = slug.replace(/-+/g, "-");

  // 앞뒤 하이픈 제거
  slug = slug.replace(/^-+|-+$/g, "");

  if (!slug) {
    slug = "product";
  }

  // 중복 충돌을 원천 방지하기 위해 5자리 고유 난수 접미사 추가
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${slug}-${randomSuffix}`;
}

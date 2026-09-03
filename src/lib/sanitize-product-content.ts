// ============================================================
// 상품 상세페이지 content(HTML) sanitize
// ============================================================
// 블로그 에디터(Toast UI Editor) 모드는 관리자가 자유 HTML을 생성할 수 있어
// (붙여넣기 등으로 의도치 않은 태그가 섞일 수 있음) 저장 전 반드시 통과시킨다.
// 이미지 나열형 모드는 이미 서버가 신뢰 가능한 <img> 태그만 조합하지만,
// 방어적으로 동일하게 한 번 더 통과시킨다.

import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

export function sanitizeProductContent(html: string | null | undefined): string | null {
  if (!html || !html.trim()) return null;

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "style"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$|^right$|^center$|^justify$/],
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(.*\)$/],
        "font-weight": [/^bold$|^\d+$/],
        width: [/^\d+(%|px)$/],
        display: [/^block$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
    exclusiveFilter: (frame) => frame.tag === "a" && !frame.attribs.href,
  });
}

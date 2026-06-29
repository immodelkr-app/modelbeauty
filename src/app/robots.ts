// ============================================================
// robots.ts — 검색 엔진 크롤링 제어
// ============================================================

import type { MetadataRoute } from "next";

const APP_URL = "https://www.modelbeauty.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 관리자/마이페이지/장바구니는 크롤링 제외
        disallow: ["/admin/", "/mypage/", "/cart", "/login"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}

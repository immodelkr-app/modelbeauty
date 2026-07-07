// ============================================================
// sitemap.ts — 자동 사이트맵 생성
// Google Search Console에 제출할 sitemap.xml을 동적으로 생성
// ============================================================

export const dynamic = "force-dynamic"; // 빌드 시 프리렌더 방지 (Supabase URL 미설정 환경 대응)

import type { MetadataRoute } from "next";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const APP_URL = "https://www.modelbeauty.kr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createSupabaseAdmin();

  // 상품 목록 조회
  const { data: products } = await admin
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  // 카테고리 목록 조회
  const { data: categories } = await admin
    .from("categories")
    .select("slug, updated_at")
    .eq("is_active", true);

  // 정적 페이지들
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: APP_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${APP_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${APP_URL}/cart`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 카테고리 페이지들
  const categoryPages: MetadataRoute.Sitemap = (categories ?? []).map((cat) => ({
    url: `${APP_URL}/products?category=${cat.slug}`,
    lastModified: new Date(cat.updated_at ?? Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 상품 상세 페이지들
  const productPages: MetadataRoute.Sitemap = (products ?? []).map((product) => ({
    url: `${APP_URL}/products/${product.slug}`,
    lastModified: new Date(product.updated_at ?? Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}

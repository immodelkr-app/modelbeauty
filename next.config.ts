import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel 무료 한도(이미지 변환 5,000건/월) 절약: 같은 이미지를 오래 캐시하고 변환 크기 단계를 줄인다
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [480, 768, 1080, 1920],
    imageSizes: [48, 96, 224, 384],
    formats: ["image/webp"],
    remotePatterns: [
      // Supabase Storage
      { protocol: "https", hostname: "siqyyissgquwykjrktqr.supabase.co" },
      // 외부 이미지 URL (상품 등록 시 사용)
      { protocol: "https", hostname: "**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

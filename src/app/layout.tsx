import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = "https://www.modelbeauty.kr";
const OG_IMAGE = `${APP_URL}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: "모델뷰티 | 뷰티의 시작",
    template: "%s | 모델뷰티",
  },
  description:
    "뷰티의 시작, 모델뷰티. 엄선된 스킨케어·메이크업·헤어·바디 제품을 합리적인 가격으로 만나보세요.",
  keywords: [
    "모델뷰티",
    "뷰티쇼핑몰",
    "화장품",
    "스킨케어",
    "메이크업",
    "헤어케어",
    "바디케어",
    "뷰티",
    "modelbeauty",
  ],

  // ── 오픈그래프 ─────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: APP_URL,
    siteName: "모델뷰티",
    title: "모델뷰티 | 뷰티의 시작",
    description:
      "뷰티의 시작, 모델뷰티. 엄선된 뷰티 제품을 합리적인 가격으로 만나보세요.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "모델뷰티 — 뷰티의 시작",
        type: "image/png",
      },
    ],
  },

  // ── 트위터 카드 ────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "모델뷰티 | 뷰티의 시작",
    description: "뷰티의 시작, 모델뷰티. 엄선된 뷰티 제품을 합리적인 가격으로 만나보세요.",
    images: [OG_IMAGE],
  },

  // ── 로봇 크롤링 설정 ───────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── 카노니컬 URL ───────────────────────────────────────────
  alternates: {
    canonical: APP_URL,
    languages: {
      "ko-KR": APP_URL,
    },
  },

  // ── 앱 메타 ────────────────────────────────────────────────
  applicationName: "모델뷰티",
  authors: [{ name: "모델뷰티", url: APP_URL }],
  creator: "모델뷰티",
  publisher: "모델뷰티",
  category: "쇼핑",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

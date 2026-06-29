import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 | 모델뷰티",
  description: "전화번호로 간편하게 로그인하세요.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

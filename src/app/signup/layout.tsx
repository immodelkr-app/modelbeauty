import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입 | 모델뷰티",
  description: "모델뷰티에 가입하고 뷰티의 시작을 경험하세요.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

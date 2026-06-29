// ============================================================
// (shop) Layout — Header + Footer를 포함한 쇼핑몰 공통 레이아웃
// /products 및 하위 경로에 적용
// ============================================================

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="shop-layout">
      <Header />
      <main className="shop-main">{children}</main>
      <Footer />
    </div>
  );
}

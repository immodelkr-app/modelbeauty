// ============================================================
// Footer — 쇼핑몰 공통 하단 정보
// ============================================================

import Link from "next/link";

const SHOP_LINKS = [
  { href: "/products", label: "전체 상품" },
  { href: "/products?featured=true", label: "베스트 셀러" },
  { href: "/products?sort=latest", label: "신상품" },
];

const INFO_LINKS = [
  { href: "/about", label: "브랜드 소개" },
  { href: "/notices", label: "공지사항" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/contact", label: "고객센터" },
];

const POLICY_LINKS = [
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
];

export default function Footer() {
  return (
    <footer className="shop-footer">
      <div className="shop-footer-inner">
        {/* 브랜드 */}
        <div className="shop-footer-brand">
          <span className="shop-logo-text">MODEL BEAUTY</span>
          <p className="shop-footer-desc">
            뷰티의 시작, 모델뷰티.<br />
            엄선된 뷰티 제품을 합리적인 가격으로 만나보세요.<br />
            피부가 아름다워지는 경험을 선사합니다.
          </p>
        </div>

        {/* 쇼핑 링크 */}
        <div>
          <p className="shop-footer-heading">쇼핑</p>
          <ul className="shop-footer-links">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 고객 서비스 */}
        <div>
          <p className="shop-footer-heading">고객 서비스</p>
          <ul className="shop-footer-links">
            {INFO_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 하단 */}
      <div className="shop-footer-bottom">
        <p className="shop-footer-copy" style={{ lineHeight: "1.7", color: "var(--mb-gray-500)" }}>
          상호명: 글로벌아임 | 대표자: 김대희 | 사업자등록번호: 365-22-00947
          <br />
          통신판매업신고번호: 제 2021-서울강남-05756 호 | 이메일: immodelkr@gmail.com
          <br />
          사업자 주소: 서울특별시 강남구 도곡로17길 16, 102동 303호(역삼동, 마이플레이스)
          <br />
          운영/반품 주소: 서울특별시 영등포구 영중로 159, 7층 (모델뷰티)
          <br />
          <span style={{ fontSize: "0.75rem", display: "inline-block", marginTop: "0.5rem" }}>
            © {new Date().getFullYear()} Model Beauty. All rights reserved.
          </span>
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.75rem",
                color: "var(--mb-gray-600, #525252)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

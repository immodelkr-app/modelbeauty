// ============================================================
// Footer — 쇼핑몰 공통 하단 정보
// ============================================================

import Link from "next/link";

const SHOP_LINKS = [
  { href: "/products", label: "전체 상품" },
  { href: "/products?featured=true", label: "모델뷰티 베스트" },
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
          <div style={{ display: "flex", gap: "0.625rem", marginTop: "1rem" }}>
            <a
              href="https://www.instagram.com/im_modelbeauty/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="모델뷰티 인스타그램"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "36px", height: "36px", borderRadius: "50%",
                background: "var(--mb-gray-100)", color: "var(--mb-gray-600, #525252)",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
          </div>
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
          통신판매업신고번호: 제 2021-서울강남-05756 호 | 대표전화: 010-5543-9674 | 이메일: immodelkr@gmail.com | 카카오톡 문의: @아임모델
          <br />
          사업자 주소: 서울시 강남구 도곡로 17길16 마이플레이스 102동303호 (글로벌아임)
          <br />
          운영·반품 주소: 서울특별시 영등포구 영중로159, 7층
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

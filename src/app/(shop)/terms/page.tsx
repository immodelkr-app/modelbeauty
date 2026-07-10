import Link from "next/link";

export const metadata = {
  title: "이용약관 - MODEL BEAUTY",
  description: "모델뷰티 쇼핑몰 서비스 이용약관입니다.",
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem 5rem", color: "var(--mb-gray-800, #374151)" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "2rem", color: "var(--mb-gray-900, #111827)", borderBottom: "2px solid var(--mb-pink-500, #db2777)", paddingBottom: "0.5rem" }}>
        이용약관
      </h1>
      
      <div style={{ fontSize: "0.875rem", lineHeight: "1.7", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제1조 (목적)</h2>
          <p style={{ margin: 0 }}>
            이 약관은 글로벌아임(이하 &quot;회사&quot;라 합니다)이 운영하는 인터넷 쇼핑몰 모델뷰티(http://modelbeauty.kr, 이하 &quot;몰&quot;이라 합니다)에서 제공하는 인터넷 관련 서비스 및 상품 구매 서비스를 이용함에 있어 몰과 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제2조 (정의)</h2>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>&quot;몰&quot;이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 아울러 인터넷 쇼핑몰을 운영하는 사업자의 의미로도 사용합니다.</li>
            <li>&quot;이용자&quot;란 몰에 접속하여 이 약관에 따라 몰이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.</li>
            <li>&quot;회원&quot;이라 함은 몰에 회원등록을 한 자로서, 계속적으로 몰이 제공하는 서비스를 이용할 수 있는 자를 말합니다.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제3조 (약관 등의 명시와 설명 및 개정)</h2>
          <p style={{ margin: 0 }}>
            몰은 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지 주소, 전화번호, 전자우편주소, 사업자등록번호, 통신판매업 신고번호 등을 이용자가 쉽게 알 수 있도록 인터넷 서비스 초기 화면에 게시합니다. 다만, 약관의 내용은 이용자가 연결화면을 통하여 볼 수 있도록 할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제4조 (서비스의 제공 및 변경)</h2>
          <p style={{ margin: 0 }}>
            몰은 재화 또는 용역의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할 재화 또는 용역의 내용을 변경할 수 있습니다. 이 경우에는 변경된 재화 또는 용역의 내용 및 제공일자를 명시하여 현재의 재화 또는 용역의 내용을 게시한 곳에 즉시 공지합니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제5조 (구매신청 및 개인정보 제공 동의 등)</h2>
          <p style={{ margin: 0 }}>
            이용자는 몰상에서 상품을 구매신청할 수 있으며, 몰은 이용자가 구매 신청을 함에 있어서 개인정보의 수집, 이용 및 제3자 제공과 관련한 동의 절차를 제공합니다. 회원은 회원가입 시 개인정보동의에 따라 본인의 정보를 구매 시 편리하게 이용할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제6조 (계약의 성립)</h2>
          <p style={{ margin: 0 }}>
            몰은 구매신청에 대하여 수신확인통지를 하고, 승낙의 의사표시가 이용자에게 도달한 시점에 계약이 성립된 것으로 봅니다. 몰의 승낙의 의사표시에는 이용자의 구매 신청에 대한 확인 및 판매가능 여부, 구매신청의 정정 취소 등에 관한 정보 등을 포함하여야 합니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제7조 (지급방법 및 결제)</h2>
          <p style={{ margin: 0 }}>
            몰에서 구매한 재화 또는 용역에 대한 대금지급방법은 신용카드, 계좌이체, 토스페이먼츠 연동 결제수단 등 몰이 허용하는 결제 수단을 통해 지급할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제8조 (청약철회 및 반품 등)</h2>
          <p style={{ margin: 0 }}>
            몰과 재화 등의 구매에 관한 계약을 체결한 이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라 상품을 수령한 날로부터 7일 이내에는 청약을 철회(반품 및 교환)할 수 있습니다. 단, 상품이 훼손되거나 사용 흔적이 있는 경우, 시간의 경과에 따라 재판매가 곤란한 화장품류의 포장 훼손 등의 경우에는 청약철회가 제한될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>제9조 (분쟁해결)</h2>
          <p style={{ margin: 0 }}>
            몰은 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 피해보상처리기구를 설치·운영합니다. 몰과 이용자 간에 발생한 전자상거래 분쟁은 관련 법령에 따르며, 관할 법원은 서울중앙지방법원으로 합니다.
          </p>
        </section>

        <div style={{ marginTop: "2rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem", display: "flex", gap: "1rem" }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--mb-pink-600, #db2777)", fontWeight: 600 }}>홈으로 돌아가기</Link>
          <span style={{ color: "#d1d5db" }}>|</span>
          <Link href="/privacy" style={{ textDecoration: "none", color: "#4b5563" }}>개인정보처리방침 보기</Link>
        </div>
      </div>
    </div>
  );
}

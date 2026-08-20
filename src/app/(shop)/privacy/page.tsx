import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 - MODEL BEAUTY",
  description: "모델뷰티 쇼핑몰 개인정보처리방침입니다.",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem 5rem", color: "var(--mb-gray-800, #374151)" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "2rem", color: "var(--mb-gray-900, #111827)", borderBottom: "2px solid var(--mb-pink-500, #db2777)", paddingBottom: "0.5rem" }}>
        개인정보처리방침
      </h1>
      
      <div style={{ fontSize: "0.875rem", lineHeight: "1.7", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        <p style={{ margin: 0, fontWeight: 500 }}>
          글로벌아임(이하 &quot;회사&quot;)은 이용자의 개인정보를 보호하고 관련 법령을 준수하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>1. 개인정보의 수집 및 이용 목적</h2>
          <p style={{ margin: 0 }}>
            회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.
          </p>
          <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
            <li>서비스 제공에 관한 계약 이행 및 서비스 제공에 따른 요금정산, 콘텐츠 제공, 구매 및 대금 결제, 물품배송 또는 청구지 등 발송</li>
            <li>회원제 서비스 이용에 따른 본인확인, 개인 식별, 가입 의사 확인, 불만처리 등 민원처리, 고지사항 전달</li>
            <li>마케팅 및 광고에 활용 (신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공)</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>2. 수집하는 개인정보 항목 및 수집방법</h2>
          <p style={{ margin: 0 }}>
            회사는 회원가입, 원활한 고객상담, 각종 서비스 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.
          </p>
          <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
            <li><strong>수집항목 (회원가입 시)</strong>: 이름, 비밀번호, 휴대전화번호, 닉네임, 서비스 이용 기록, 접속 로그, 쿠키, 접속 IP 정보</li>
            <li><strong>상품 구매/배송 시</strong>: 수령인 이름, 수령인 전화번호, 배송지 주소, 결제 정보 (신용카드 정보, 은행계좌 정보 등)</li>
            <li><strong>개인정보 수집방법</strong>: 홈페이지 회원가입, 배송 요청 폼 입력, 고객센터 문의 게시판</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>3. 개인정보의 보유 및 이용기간</h2>
          <p style={{ margin: 0 }}>
            이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다. **특히 이용자가 "회원 탈퇴 (계정 삭제)"를 신청한 경우, 수집된 이름, 연락처, 닉네임 등의 식별 데이터는 지체 없이 즉시 파기**됩니다.
          </p>
          <p style={{ margin: "0.5rem 0 0 0" }}>
            단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계법령에서 정한 일정한 기간 동안 회원정보를 보관하며, 보존 기간 종료 시 완전히 삭제합니다.
          </p>
          <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래등에서의 소비자보호에 관한 법률)</li>
            <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래등에서의 소비자보호에 관한 법률)</li>
            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래등에서의 소비자보호에 관한 법률)</li>
            <li>웹사이트 방문기록(로그): 3개월 (통신비밀보호법)</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>4. 개인정보의 파기절차 및 방법</h2>
          <p style={{ margin: 0 }}>
            회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후(또는 회원 탈퇴 시)에는 해당 정보를 지체 없이 파기합니다. 파기절차 및 방법은 다음과 같습니다.
          </p>
          <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
            <li><strong>파기절차</strong>: 이용자가 회원 탈퇴 등을 통해 파기를 신청한 정보는 관련 법령(3항 참조)에 의한 정보보호 보존 사유를 제외하고는 즉시 파기 처리됩니다. 별도 DB로 이관된 정보는 법적 사유 외의 다른 목적으로 이용되지 않습니다.</li>
            <li><strong>파기방법</strong>: 전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다. 데이터베이스 내의 식별자 데이터는 익명화 및 난수 처리를 통해 물리적으로 파기됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111827" }}>5. 개인정보보호책임자 및 담당자 연락처</h2>
          <p style={{ margin: 0 }}>
            회사는 고객의 개인정보를 보호하고 개인정보와 관련한 불만을 처리하기 위하여 아래와 같이 관련 부서 및 개인정보보호책임자를 지정하고 있습니다.
          </p>
          <div style={{ marginTop: "0.5rem", background: "var(--mb-gray-50, #f9fafb)", padding: "1rem", borderRadius: "10px", border: "1px solid var(--mb-gray-200, #e5e7eb)" }}>
            <p style={{ margin: "0 0 0.5rem 0" }}><strong>개인정보 보호책임자</strong></p>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem" }}>
              <li>성명: 김대희</li>
              <li>직책: 대표</li>
              <li>소속: 글로벌아임</li>
              <li>이메일: immodelkr@gmail.com</li>
              <li>전화번호: 010-5543-9674</li>
            </ul>
          </div>
        </section>

        <div style={{ marginTop: "2rem", borderTop: "1px solid #e5e7eb", paddingTop: "1.5rem", display: "flex", gap: "1rem" }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--mb-pink-600, #db2777)", fontWeight: 600 }}>홈으로 돌아가기</Link>
          <span style={{ color: "#d1d5db" }}>|</span>
          <Link href="/terms" style={{ textDecoration: "none", color: "#4b5563" }}>이용약관 보기</Link>
        </div>
      </div>
    </div>
  );
}

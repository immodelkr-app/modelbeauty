"use client";

// ============================================================
// /checkout/success — 결제 성공 후 최종 승인 처리
// 토스페이먼츠가 paymentKey, orderId, amount 쿼리파라미터로 리다이렉트
// ============================================================

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { updateMasterUser } from "@/lib/core-auth";
import { Suspense } from "react";
import Link from "next/link";

type Status = "loading" | "success" | "error";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart, removeItem } = useCartStore();
  const { masterUser, setMasterUser } = useAuthStore();

  const [status, setStatus] = useState<Status>("loading");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [approvedAt, setApprovedAt] = useState("");
  const [amount, setAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amountStr = searchParams.get("amount");

    if (!paymentKey || !orderId || !amountStr) {
      setStatus("error");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    const amt = Number(amountStr);

    // 서버에 결제 최종 승인 요청
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: amt }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setOrderNumber(data.orderNumber);
          setPaymentMethod(data.method);
          setApprovedAt(data.approvedAt);
          setAmount(amt);
          setStatus("success");
          // 바로구매 아이템 삭제 처리 또는 전체 비우기
          const directItemId = sessionStorage.getItem("direct_checkout_item_id");
          if (directItemId) {
            removeItem(directItemId);
            sessionStorage.removeItem("direct_checkout_item_id");
          } else {
            clearCart(); // 장바구니 비우기
          }

          // 기본 주소로 저장 처리
          const savedAddrRaw = sessionStorage.getItem("save_address_on_success");
          if (savedAddrRaw && masterUser?.masterUserId) {
            try {
              const savedAddr = JSON.parse(savedAddrRaw);
              updateMasterUser(masterUser.masterUserId, {
                shipping_recipient: savedAddr.recipient,
                shipping_phone: savedAddr.phone,
                shipping_zipcode: savedAddr.zipcode,
                shipping_address: savedAddr.address,
                shipping_detail: savedAddr.detail,
              }).then((updatedMaster) => {
                setMasterUser(updatedMaster);
                console.log("[SuccessContent] 기본 주소 동기화 완료");
              }).catch((e) => {
                console.error("[SuccessContent] 기본 주소 API 호출 실패:", e);
              });
            } catch (err) {
              console.error("[SuccessContent] 기본 주소 파싱 오류:", err);
            } finally {
              sessionStorage.removeItem("save_address_on_success");
            }
          }
        } else {
          setStatus("error");
          setErrorMsg(data.error || "결제 승인에 실패했습니다.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("결제 승인 중 오류가 발생했습니다.");
      });
  }, [searchParams, clearCart]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
          <p style={{ color: "var(--mb-gray-600)", fontWeight: 600 }}>결제를 승인하고 있습니다...</p>
          <p style={{ color: "var(--mb-gray-400)", fontSize: "0.875rem" }}>잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "0 1rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>❌</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--mb-gray-900)", marginBottom: "0.5rem" }}>
            결제 승인 실패
          </h1>
          <p style={{ color: "var(--mb-gray-600)", marginBottom: "1.5rem" }}>{errorMsg}</p>
          <Link href="/cart"
            style={{
              display: "inline-block", padding: "0.75rem 2rem",
              background: "linear-gradient(135deg, #db2777, #9333ea)",
              color: "#fff", borderRadius: "12px", textDecoration: "none",
              fontWeight: 700,
            }}>
            장바구니로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // 성공
  const formattedDate = approvedAt
    ? new Date(approvedAt).toLocaleString("ko-KR", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const methodLabel: Record<string, string> = {
    카드: "신용/체크카드",
    간편결제: "간편결제",
    가상계좌: "가상계좌",
    계좌이체: "계좌이체",
    휴대폰: "휴대폰 결제",
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "3rem 1rem 5rem" }}>
      {/* 성공 아이콘 */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "2rem", margin: "0 auto 1rem",
          boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
        }}>✓</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: "0 0 0.5rem" }}>
          결제가 완료되었습니다!
        </h1>
        <p style={{ color: "var(--mb-gray-500)", fontSize: "0.9375rem" }}>
          주문해 주셔서 감사합니다 💄
        </p>
      </div>

      {/* 결제 상세 */}
      <div style={{
        background: "#fff", borderRadius: "20px", padding: "1.5rem",
        border: "1px solid var(--mb-gray-100)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        marginBottom: "1.5rem",
      }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--mb-gray-700)", margin: "0 0 1rem" }}>
          결제 정보
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            { label: "주문번호", value: orderNumber },
            { label: "결제 방법", value: methodLabel[paymentMethod] ?? paymentMethod },
            { label: "결제 금액", value: `${amount.toLocaleString("ko-KR")}원`, bold: true, pink: true },
            { label: "결제 일시", value: formattedDate },
          ].map(({ label, value, bold, pink }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--mb-gray-500)" }}>{label}</span>
              <span style={{
                fontSize: bold ? "1rem" : "0.875rem",
                fontWeight: bold ? 800 : 600,
                color: pink ? "var(--mb-pink-600)" : "var(--mb-gray-800)",
              }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 포인트 적립 안내 */}
      <div style={{
        background: "linear-gradient(135deg, rgba(219,39,119,0.06), rgba(147,51,234,0.06))",
        borderRadius: "14px", padding: "1rem 1.25rem",
        border: "1px solid rgba(219,39,119,0.15)",
        marginBottom: "1.5rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
      }}>
        <span style={{ fontSize: "1.5rem" }}>✨</span>
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--mb-pink-700)" }}>
            {Math.floor(amount * 0.01).toLocaleString()}P 적립 예정
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
            구매 확정 후 통합 포인트로 지급됩니다
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Link href="/mypage/orders"
          style={{
            display: "block", textAlign: "center", padding: "1rem",
            background: "linear-gradient(135deg, #db2777, #9333ea)",
            color: "#fff", borderRadius: "14px", textDecoration: "none",
            fontWeight: 700, fontSize: "1rem",
          }}>
          📦 내 주문 확인하기
        </Link>
        <Link href="/products"
          style={{
            display: "block", textAlign: "center", padding: "0.875rem",
            border: "1px solid var(--mb-gray-200)", borderRadius: "14px",
            textDecoration: "none", color: "var(--mb-gray-700)",
            fontWeight: 600, fontSize: "0.9375rem",
          }}>
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--mb-gray-500)" }}>⏳ 로딩 중...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

"use client";

// ============================================================
// /checkout/fail — 결제 실패/취소 페이지
// ============================================================

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const message = searchParams.get("message") ?? "결제가 취소되었습니다.";
  const orderId = searchParams.get("orderId") ?? "";

  const isUserCancel = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "4rem 1rem 5rem", textAlign: "center" }}>
      <div style={{
        width: "80px", height: "80px", borderRadius: "50%",
        background: isUserCancel
          ? "linear-gradient(135deg, #f59e0b, #d97706)"
          : "linear-gradient(135deg, #ef4444, #dc2626)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "2rem", margin: "0 auto 1.5rem",
        boxShadow: isUserCancel
          ? "0 8px 24px rgba(245,158,11,0.3)"
          : "0 8px 24px rgba(239,68,68,0.3)",
      }}>
        {isUserCancel ? "↩" : "✕"}
      </div>

      <h1 style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: "0 0 0.75rem" }}>
        {isUserCancel ? "결제가 취소되었습니다" : "결제에 실패했습니다"}
      </h1>

      <p style={{ color: "var(--mb-gray-600)", fontSize: "0.9375rem", margin: "0 0 0.5rem" }}>
        {message}
      </p>

      {code && !isUserCancel && (
        <p style={{ color: "var(--mb-gray-400)", fontSize: "0.8125rem", margin: "0 0 2rem" }}>
          오류 코드: {code}
        </p>
      )}

      {isUserCancel && (
        <p style={{ color: "var(--mb-gray-400)", fontSize: "0.875rem", margin: "0 0 2rem" }}>
          장바구니에 상품이 그대로 남아있어요.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Link href="/cart"
          style={{
            display: "block", padding: "1rem",
            background: "linear-gradient(135deg, #db2777, #9333ea)",
            color: "#fff", borderRadius: "14px", textDecoration: "none",
            fontWeight: 700, fontSize: "1rem",
          }}>
          🛒 장바구니로 돌아가기
        </Link>
        <Link href="/products"
          style={{
            display: "block", padding: "0.875rem",
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

export default function CheckoutFailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--mb-gray-500)" }}>⏳ 로딩 중...</div>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}

"use client";

// ============================================================
// HeaderCartButton — 장바구니 아이콘 + 수량 뱃지 (Client Component)
// cart store에서 itemCount를 읽어 뱃지로 표시
// ============================================================

import Link from "next/link";
import { useCartStore } from "@/store/cart.store";

export default function HeaderCartButton() {
  const itemCount = useCartStore((s) => s.itemCount);

  return (
    <Link href="/cart" className="shop-icon-btn" aria-label={`장바구니 ${itemCount > 0 ? `(${itemCount}개)` : ""}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <line x1="3" x2="21" y1="6" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>

      {itemCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            minWidth: "18px",
            height: "18px",
            padding: "0 4px",
            background: "var(--mb-gradient)",
            borderRadius: "100px",
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid #fff",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}

"use client";

// ============================================================
// /admin/settings — 관리자 설정
// 생일 쿠폰 자동발급 설정은 /admin/coupons(쿠폰 관리)로 이동했습니다.
// ============================================================

import Link from "next/link";

export default function AdminSettingsPage() {
  return (
    <>
      <div className="admin-section-header">
        <div>
          <h1 className="admin-section-title">⚙️ 설정</h1>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "4px" }}>
            자동화 기능에 필요한 값들을 관리합니다.
          </p>
        </div>
      </div>

      <div className="admin-card" style={{ padding: "1.5rem", maxWidth: "560px" }}>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
          쿠폰 템플릿 생성 및 생일 쿠폰 자동발급 설정은{" "}
          <Link href="/admin/coupons" style={{ color: "var(--mb-pink-500, #ec4899)", fontWeight: 700 }}>
            🎟️ 쿠폰 관리
          </Link>
          {" "}페이지로 이동했습니다.
        </p>
      </div>
    </>
  );
}

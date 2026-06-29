"use client";

// ============================================================
// /mypage/points — 포인트 페이지
// im-core-auth 통합 포인트 (조회 전용)
// ============================================================

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

const POINT_GUIDE = [
  { icon: "🛒", title: "구매 적립", desc: "구매 금액의 1%를 포인트로 적립해 드립니다." },
  { icon: "✨", title: "통합 포인트", desc: "MOCA, IMFF, 모델뷰티에서 공통으로 사용할 수 있습니다." },
  { icon: "📅", title: "유효기간", desc: "포인트는 마지막 사용일로부터 1년간 유효합니다." },
  { icon: "💎", title: "최소 사용", desc: "1,000P 이상부터 사용 가능합니다." },
];

export default function PointsPage() {
  const { masterUser, isLoading } = useAuthStore();
  const points = masterUser?.integratedPoints ?? 0;

  // 예상 적립 예시 계산
  const examples = [
    { price: 10000, point: Math.floor(10000 * 0.01) },
    { price: 30000, point: Math.floor(30000 * 0.01) },
    { price: 50000, point: Math.floor(50000 * 0.01) },
  ];

  return (
    <>
      <h1 className="mypage-section-title">포인트</h1>

      {/* 포인트 잔액 카드 */}
      <div className="point-balance-card">
        <p className="point-balance-label">보유 포인트</p>
        <p className="point-balance-value">
          {isLoading ? "···" : points.toLocaleString("ko-KR")}
          <span className="point-balance-unit">P</span>
        </p>
        <p className="point-balance-info">
          MOCA · IMFF · 모델뷰티 통합 포인트
        </p>
      </div>

      {/* 안내 */}
      <div className="point-notice">
        <span aria-hidden="true" style={{ fontSize: "1.25rem", flexShrink: 0 }}>
          ℹ️
        </span>
        <span>
          포인트 내역 상세 조회 및 사용은 결제 단계에서 확인할 수 있습니다.
          <br />
          포인트는 MOCA, IMFF, 모델뷰티 세 앱에서 통합 관리됩니다.
        </span>
      </div>

      {/* 적립 가이드 */}
      <h2
        style={{
          fontSize: "1.0625rem",
          fontWeight: 800,
          color: "var(--mb-gray-900)",
          margin: "0 0 1rem",
        }}
      >
        포인트 안내
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        {POINT_GUIDE.map((item) => (
          <div
            key={item.title}
            style={{
              background: "#fff",
              border: "1.5px solid var(--mb-gray-100)",
              borderRadius: "16px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }} aria-hidden="true">
              {item.icon}
            </span>
            <p
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--mb-gray-900)",
                margin: 0,
              }}
            >
              {item.title}
            </p>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--mb-gray-500)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* 적립 시뮬레이터 */}
      <h2
        style={{
          fontSize: "1.0625rem",
          fontWeight: 800,
          color: "var(--mb-gray-900)",
          margin: "0 0 1rem",
        }}
      >
        구매 시 예상 적립 포인트
      </h2>
      <div
        style={{
          background: "#fff",
          border: "1.5px solid var(--mb-gray-100)",
          borderRadius: "16px",
          overflow: "hidden",
          marginBottom: "2.5rem",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--mb-gray-50)" }}>
              {["구매 금액", "적립 포인트 (1%)"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.875rem 1.25rem",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: "var(--mb-gray-500)",
                    textAlign: "left",
                    borderBottom: "1px solid var(--mb-gray-100)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {examples.map((ex, i) => (
              <tr
                key={ex.price}
                style={{
                  borderBottom:
                    i < examples.length - 1
                      ? "1px solid var(--mb-gray-100)"
                      : "none",
                }}
              >
                <td
                  style={{
                    padding: "0.875rem 1.25rem",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "var(--mb-gray-800)",
                  }}
                >
                  {ex.price.toLocaleString("ko-KR")}원
                </td>
                <td
                  style={{
                    padding: "0.875rem 1.25rem",
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--mb-pink-600)",
                  }}
                >
                  +{ex.point.toLocaleString("ko-KR")}P
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center" }}>
        <Link href="/products" className="hero-cta-primary">
          쇼핑하고 포인트 적립하기 ✨
        </Link>
      </div>
    </>
  );
}

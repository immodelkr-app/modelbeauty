"use client";

// ============================================================
// /admin/settings — 관리자 설정
// 생일 쿠폰 자동발급 설정은 /admin/coupons(쿠폰 관리)로 이동했습니다.
// ============================================================

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface InstagramStatus {
  connected: boolean;
  expiresAt: string | null;
}

function InstagramConnectCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const callbackResult = searchParams.get("instagram");

  useEffect(() => {
    fetch("/api/admin/instagram/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setStatus(json.data);
      })
      .finally(() => setLoading(false));
  }, [callbackResult]);

  const callbackMessage: Record<string, { text: string; color: string }> = {
    connected: { text: "인스타그램 연동이 완료되었습니다.", color: "#16a34a" },
    error: { text: "연동 중 오류가 발생했습니다. 다시 시도해 주세요.", color: "#dc2626" },
    unauthorized: { text: "관리자 로그인 상태에서 다시 시도해 주세요.", color: "#dc2626" },
  };

  return (
    <div className="admin-card" style={{ padding: "1.5rem", maxWidth: "560px" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
        📷 인스타그램 연동 (@im_modelbeauty)
      </h2>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0 0 1rem" }}>
        연동하면 홈 화면에 우리 계정의 최근 게시물이 썸네일 그리드로 노출됩니다.
      </p>

      {callbackResult && callbackMessage[callbackResult] && (
        <p style={{ fontSize: "0.8125rem", color: callbackMessage[callbackResult].color, margin: "0 0 1rem", fontWeight: 600 }}>
          {callbackMessage[callbackResult].text}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: "0.875rem", color: "#9ca3af", margin: 0 }}>확인 중…</p>
      ) : status?.connected ? (
        <div>
          <p style={{ fontSize: "0.875rem", color: "#16a34a", fontWeight: 600, margin: "0 0 0.5rem" }}>
            ✅ 연동됨
            {status.expiresAt && (
              <span style={{ color: "#6b7280", fontWeight: 400 }}>
                {" "}(토큰 만료: {new Date(status.expiresAt).toLocaleDateString("ko-KR")}, 매일 자동 갱신됩니다)
              </span>
            )}
          </p>
          <a
            href="/api/admin/instagram/connect"
            style={{ fontSize: "0.8125rem", color: "var(--mb-pink-500, #ec4899)", fontWeight: 600 }}
          >
            다시 연동하기 →
          </a>
        </div>
      ) : (
        <a href="/api/admin/instagram/connect" className="admin-btn admin-btn-primary">
          인스타그램 계정 연동하기
        </a>
      )}
    </div>
  );
}

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

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Suspense fallback={null}>
          <InstagramConnectCard />
        </Suspense>

        <div className="admin-card" style={{ padding: "1.5rem", maxWidth: "560px" }}>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
            쿠폰 템플릿 생성 및 생일 쿠폰 자동발급 설정은{" "}
            <Link href="/admin/coupons" style={{ color: "var(--mb-pink-500, #ec4899)", fontWeight: 700 }}>
              🎟️ 쿠폰 관리
            </Link>
            {" "}페이지로 이동했습니다.
          </p>
        </div>
      </div>
    </>
  );
}

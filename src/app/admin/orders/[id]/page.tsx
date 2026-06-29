"use client";
// /admin/orders/[id] — 주문 상세 + 상태 변경

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { CARRIER_CODES } from "@/lib/sweettracker";
import TrackingTimeline from "@/components/tracking/TrackingTimeline";

const STATUS_OPTIONS = [
  { value: "pending",          label: "⏳ 결제 대기" },
  { value: "paid",             label: "✅ 결제 완료" },
  { value: "preparing",        label: "📦 상품 준비중" },
  { value: "shipping",         label: "🚚 배송중" },
  { value: "delivered",        label: "📬 배송 완료" },
  { value: "confirmed",        label: "✔️ 구매 확정" },
  { value: "cancelled",        label: "✖️ 주문 취소" },
  { value: "refund_requested", label: "↩️ 환불 요청" },
  { value: "refunded",         label: "💰 환불 완료" },
];

const STATUS_KO: Record<string, string> = {
  pending: "결제 대기", paid: "결제 완료", preparing: "상품 준비중", shipping: "배송중",
  delivered: "배송 완료", confirmed: "구매 확정", cancelled: "주문 취소",
  refund_requested: "환불 요청", refunded: "환불 완료",
};

function formatPrice(n: number) { return n.toLocaleString("ko-KR") + "원"; }

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // 배송 등록
  const [shipCarrier, setShipCarrier] = useState("04");
  const [shipTracking, setShipTracking] = useState("");
  const [shipSaving, setShipSaving] = useState(false);
  const [shipSaved, setShipSaved] = useState(false);
  const [shipError, setShipError] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setOrderId(id);
      fetch(`/api/admin/orders/${id}`)
        .then((r) => r.json())
        .then(({ data }) => {
          setOrder(data);
          setNewStatus(data?.status ?? "");
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === order?.status) return;
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, note }),
    });
    const { data } = await res.json();
    if (data) {
      setOrder((prev) => ({ ...prev, status: data.status }));
      setSaved(true);
      setNote("");
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>불러오는 중...</div>;
  if (!order) return (
    <div className="admin-empty">
      <div className="admin-empty-icon">🔍</div>
      <p className="admin-empty-title">주문을 찾을 수 없습니다</p>
      <Link href="/admin/orders" className="admin-btn admin-btn-primary" style={{ marginTop: "1rem", display: "inline-flex" }}>목록으로</Link>
    </div>
  );

  const items = (order.order_items as Record<string, unknown>[]) ?? [];
  const shipping = order.shipping_info as Record<string, unknown> | null;

  return (
    <>
      <div className="admin-section-header">
        <h1 className="admin-section-title">
          주문 상세
          <span className="admin-text-mono" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#9ca3af", marginLeft: "0.75rem" }}>
            {order.order_number as string}
          </span>
        </h1>
        <Link href="/admin/orders" className="admin-btn admin-btn-secondary">← 목록으로</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        {/* 상태 변경 */}
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>주문 상태 변경</h2>
          {saved && <div className="admin-alert admin-alert-success" style={{ marginBottom: "1rem" }}>✅ 상태가 변경되었습니다.</div>}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="admin-field" style={{ flex: 1, minWidth: "200px" }}>
              <label className="admin-label">새 상태</label>
              <select className="admin-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="admin-field" style={{ flex: 2, minWidth: "200px" }}>
              <label className="admin-label">메모 (선택)</label>
              <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="상태 변경 사유..." />
            </div>
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleStatusChange}
              disabled={saving || newStatus === order.status}
              style={{ alignSelf: "flex-end" }}
            >
              {saving ? "저장 중..." : "상태 변경"}
            </button>
          </div>
          <p style={{ fontSize: "0.8125rem", color: "#9ca3af", marginTop: "0.75rem" }}>
            현재 상태: <strong style={{ color: "#111827" }}>{STATUS_KO[order.status as string] ?? order.status as string}</strong>
          </p>
        </div>

        {/* 주문 정보 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          <div className="admin-card" style={{ padding: "1.5rem" }}>
            <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>배송 정보</h2>
            <dl style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {(
                [
                  ["수령인", order.recipient_name],
                  ["연락처", order.recipient_phone],
                  ["우편번호", order.address_zipcode],
                  ["주소", order.address_main],
                  ["상세 주소", order.address_detail ?? "—"],
                  ["배송 메모", order.delivery_memo ?? "—"],
                ] as [string, unknown][]
              ).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: "0.75rem" }}>
                  <dt style={{ fontSize: "0.8125rem", color: "#6b7280", width: "72px", flexShrink: 0, fontWeight: 600 }}>{k}</dt>
                  <dd style={{ fontSize: "0.875rem", color: "#111827", margin: 0 }}>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="admin-card" style={{ padding: "1.5rem" }}>
            <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>결제 정보</h2>
            <dl style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {(
                [
                  ["결제 상태", order.payment_status],
                  ["결제 수단", order.payment_method ?? "—"],
                  ["상품 합계", formatPrice(order.subtotal as number)],
                  ["배송비", formatPrice(order.shipping_fee as number)],
                  ["포인트 할인", `−${formatPrice(order.point_discount as number)}`],
                  ["최종 결제", formatPrice(order.total_amount as number)],
                ] as [string, unknown][]
              ).map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: "0.75rem" }}>
                  <dt style={{ fontSize: "0.8125rem", color: "#6b7280", width: "80px", flexShrink: 0, fontWeight: 600 }}>{k}</dt>
                  <dd style={{ fontSize: "0.875rem", color: "#111827", margin: 0, fontWeight: k === "최종 결제" ? 800 : 400 }}>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* 주문 상품 */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">주문 상품 ({items.length}개)</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>상품</th>
                  <th>옵션</th>
                  <th>단가</th>
                  <th>수량</th>
                  <th>소계</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const prod = item.products as { images?: { url: string }[] } | null;
                  const thumb = prod?.images?.[0]?.url ?? null;
                  return (
                    <tr key={item.id as string}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <div className="admin-table-thumb">
                            {thumb ? <Image src={thumb} alt={item.product_name as string} fill sizes="44px" style={{ objectFit: "cover" }} /> : "💄"}
                          </div>
                          <span style={{ fontWeight: 600 }}>{item.product_name as string}</span>
                        </div>
                      </td>
                      <td>
                        {item.variant_info
                          ? Object.values(item.variant_info as Record<string, string>).join(" / ")
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td>{formatPrice(item.unit_price as number)}</td>
                      <td>{item.quantity as number}개</td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(item.subtotal as number)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 배송 등록 / 추적 */}
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          <h2 className="admin-card-title" style={{ marginBottom: "1rem" }}>배송 관리</h2>

          {/* 이미 배송 정보가 있으면 TrackingTimeline 표시 */}
          {shipping ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <TrackingTimeline
                carrierCode={shipping.carrier_code as string}
                carrierName={shipping.carrier_name as string}
                trackingNumber={shipping.tracking_number as string}
                orderId={orderId}
              />
              <p style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>
                운송장 번호를 변경하려면 아래 폼에 다시 입력하세요.
              </p>
            </div>
          ) : null}

          {/* 배송 등록 폼 */}
          <div style={{ marginTop: shipping ? "1.25rem" : 0 }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#374151", marginBottom: "0.875rem" }}>
              {shipping ? "배송 정보 변경" : "배송 등록"}
            </h3>
            {shipSaved && (
              <div className="admin-alert admin-alert-success" style={{ marginBottom: "1rem" }}>
                ✅ 배송 정보가 등록되었습니다. 주문 상태가 &apos;배송중&apos;으로 변경되었습니다.
              </div>
            )}
            {shipError && (
              <div className="admin-alert admin-alert-warn" style={{ marginBottom: "1rem" }}>
                ⚠️ {shipError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="admin-field" style={{ minWidth: "180px" }}>
                <label className="admin-label">택배사</label>
                <select
                  className="admin-select"
                  value={shipCarrier}
                  onChange={(e) => setShipCarrier(e.target.value)}
                >
                  {Object.entries(CARRIER_CODES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-field" style={{ flex: 1, minWidth: "200px" }}>
                <label className="admin-label">운송장 번호</label>
                <input
                  className="admin-input"
                  value={shipTracking}
                  onChange={(e) => setShipTracking(e.target.value)}
                  placeholder="1234567890123"
                />
              </div>
              <button
                className="admin-btn admin-btn-primary"
                style={{ alignSelf: "flex-end" }}
                disabled={!shipTracking || shipSaving}
                onClick={async () => {
                  setShipSaving(true);
                  setShipError("");
                  const res = await fetch("/api/admin/shipping", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      orderId,
                      carrierCode: shipCarrier,
                      trackingNumber: shipTracking,
                    }),
                  });
                  const result = await res.json();
                  if (!res.ok) {
                    setShipError(result.error ?? "배송 등록 실패");
                  } else {
                    setShipSaved(true);
                    setTimeout(() => setShipSaved(false), 3000);
                    // 페이지 리로드로 shipping 반영
                    window.location.reload();
                  }
                  setShipSaving(false);
                }}
              >
                {shipSaving ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

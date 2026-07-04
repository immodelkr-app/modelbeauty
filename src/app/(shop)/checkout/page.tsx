"use client";

// ============================================================
// /checkout — 체크아웃 페이지
// Step 1: 배송지 입력 → Step 2: 결제위젯
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";

const SHIPPING_FREE_THRESHOLD = 50_000;
const SHIPPING_FEE = 3_000;
const POINT_REWARD_RATE = 0.01; // 구매금액의 1% 적립

function fmt(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

type CheckoutStep = "address" | "payment";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCartStore();
  const { masterUser, isLoggedIn, isLoading: authLoading } = useAuthStore();

  // 배송지 폼
  const [form, setForm] = useState({
    recipientName: masterUser?.name ?? "",
    recipientPhone: "",
    addressZipcode: "",
    addressMain: "",
    addressDetail: "",
    deliveryMemo: "",
  });

  const [step, setStep] = useState<CheckoutStep>("address");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [orderNumber, setOrderNumber] = useState("");
  const paymentRef = useRef<HTMLDivElement>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

  // Toss 위젯 인스턴스
  const tossWidgetRef = useRef<unknown>(null);

  // 포인트 및 쿠폰 관련 상태
  const [coupons, setCoupons] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [pointInput, setPointInput] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(0);

  // 금액 계산
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;

  // 쿠폰 할인 계산
  let couponDiscount = 0;
  if (selectedCoupon) {
    if (selectedCoupon.discountType === "fixed") {
      couponDiscount = selectedCoupon.discountValue;
    } else if (selectedCoupon.discountType === "percent") {
      couponDiscount = Math.floor(subtotal * (selectedCoupon.discountValue / 100));
      if (selectedCoupon.maxDiscountAmount) {
        couponDiscount = Math.min(couponDiscount, selectedCoupon.maxDiscountAmount);
      }
    }
  }

  // 포인트 할인 계산 (조건 A: 1만원 이상 구매 시, 상품 금액의 최대 30%까지 사용 가능)
  const maxAvailablePoints = masterUser?.integratedPoints ?? 0;
  const maxPointsAllowed = subtotal >= 10000 ? Math.floor(subtotal * 0.3) : 0;
  const maxPointsToUse = Math.min(maxPointsAllowed, Math.max(0, subtotal - couponDiscount));
  const actualPointDiscount = Math.min(appliedPoints, maxPointsToUse);

  const finalTotal = Math.max(0, subtotal + shippingFee - actualPointDiscount - couponDiscount);
  const estimatedPoints = Math.floor(finalTotal * POINT_REWARD_RATE);

  // 비로그인 처리
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace("/login?redirect=/checkout");
    }
  }, [authLoading, isLoggedIn, router]);

  // 장바구니 비어있는 경우
  useEffect(() => {
    if (!authLoading && items.length === 0) {
      router.replace("/cart");
    }
  }, [authLoading, items.length, router]);

  // masterUser 이름 폼에 자동 입력 및 쿠폰 조회
  useEffect(() => {
    if (masterUser?.name && !form.recipientName) {
      setForm((f) => ({ ...f, recipientName: masterUser.name ?? "" }));
    }
  }, [masterUser]);

  useEffect(() => {
    if (isLoggedIn) {
      fetch("/api/coupons")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setCoupons(data.coupons || []);
          }
        })
        .catch((e) => console.error("쿠폰 정보 로딩 실패:", e));
    }
  }, [isLoggedIn]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // 전화번호 포맷
  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  };

  // Step 1 완료 → 주문 생성 → Step 2 결제위젯
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.recipientName || !form.recipientPhone || !form.addressZipcode || !form.addressMain) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 주문 생성
      const orderItems = items.map((item) => {
        return {
          productId: item.product?.id,
          variantId: item.variant?.id ?? null,
          productName: item.product?.name ?? "상품",
          variantInfo: item.variant?.optionValues ?? null,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        };
      });

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: masterUser?.masterUserId,
          items: orderItems,
          ...form,
          recipientPhone: form.recipientPhone.replace(/-/g, ""),
          usedPointAmount: actualPointDiscount,
          usedCouponId: selectedCoupon?.userCouponId ?? null,
          usedCouponCode: selectedCoupon?.code ?? null,
          couponDiscount: couponDiscount,
          liveStreamId: typeof window !== "undefined" ? sessionStorage.getItem("last_live_stream_id") : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "주문 생성에 실패했습니다.");
        return;
      }

      setOrderId(data.orderId);
      setOrderNumber(data.orderNumber);
      setTotalAmount(data.totalAmount);
      setStep("payment");

      // 결제위젯 초기화 (DOM이 렌더된 후)
      setTimeout(() => initTossWidget(data.orderId, data.orderNumber, data.totalAmount), 300);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 토스페이먼츠 결제위젯 초기화
  const initTossWidget = async (oid: string, oNum: string, amount: number) => {
    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      );

      const widgets = tossPayments.widgets({
        customerKey: masterUser?.masterUserId ?? "GUEST",
      });

      await widgets.setAmount({ currency: "KRW", value: amount });

      if (paymentRef.current) {
        await widgets.renderPaymentMethods({
          selector: "#payment-method",
          variantKey: "DEFAULT",
        });
      }

      if (agreementRef.current) {
        await widgets.renderAgreement({
          selector: "#payment-agreement",
          variantKey: "AGREEMENT",
        });
      }

      tossWidgetRef.current = { widgets, oid, oNum, amount };
    } catch (err) {
      console.error("토스 위젯 초기화 실패:", err);
      setError("결제 모듈 로드에 실패했습니다. 페이지를 새로고침해 주세요.");
    }
  };

  // 결제 요청
  const handlePayment = async () => {
    if (!tossWidgetRef.current) {
      setError("결제 모듈이 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const { widgets, oid, oNum } = tossWidgetRef.current as {
        widgets: { requestPayment: (params: Record<string, unknown>) => Promise<void> };
        oid: string;
        oNum: string;
        amount: number;
      };

      await widgets.requestPayment({
        orderId: oid,
        orderName: items.length === 1
          ? (items[0].product?.name ?? "상품")
          : `${items[0].product?.name ?? "상품"} 외 ${items.length - 1}건`,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: undefined,
        customerName: form.recipientName,
        customerMobilePhone: form.recipientPhone.replace(/-/g, ""),
      });
    } catch (err: unknown) {
      setIsSubmitting(false);
      // 사용자가 결제창을 닫은 경우는 무시
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "USER_CANCEL") return;
      }
      setError("결제 요청 중 오류가 발생했습니다.");
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--mb-gray-500)" }}>⏳ 로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1rem 4rem" }}>
      {/* 헤더 */}
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/cart" style={{ fontSize: "0.875rem", color: "var(--mb-gray-500)", textDecoration: "none" }}>
          ← 장바구니로
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0", color: "var(--mb-gray-900)" }}>
          주문/결제
        </h1>
      </div>

      {/* 진행 단계 */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", alignItems: "center" }}>
        {(["address", "payment"] as const).map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {i > 0 && <div style={{ width: "2rem", height: "1px", background: "var(--mb-gray-200)" }} />}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              color: step === s ? "var(--mb-pink-500)" : (
                (s === "address" && step === "payment") ? "var(--mb-gray-400)" : "var(--mb-gray-400)"
              ),
              fontWeight: step === s ? 700 : 500,
              fontSize: "0.875rem",
            }}>
              <div style={{
                width: "1.5rem", height: "1.5rem", borderRadius: "50%",
                background: step === s ? "var(--mb-pink-500)" : "var(--mb-gray-200)",
                color: step === s ? "#fff" : "var(--mb-gray-500)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 700,
              }}>{i + 1}</div>
              {s === "address" ? "배송지" : "결제"}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr" }}>

        {/* ── Step 1: 배송지 입력 ── */}
        {step === "address" && (
          <form onSubmit={handleAddressSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* 주문 상품 요약 */}
            <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", color: "var(--mb-gray-900)" }}>
                주문 상품 ({items.length}개)
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {items.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {item.product?.images?.[0]?.url && (
                      <img
                        src={item.product.images[0].url}
                        alt={item.product.name}
                        style={{ width: "52px", height: "52px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--mb-gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.product?.name}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
                        {item.quantity}개 · {fmt(item.subtotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 배송지 정보 */}
            <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1.25rem", color: "var(--mb-gray-900)" }}>
                배송지 정보
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <div>
                  <label style={labelStyle}>수령인 *</label>
                  <input name="recipientName" value={form.recipientName} onChange={handleInput}
                    placeholder="이름을 입력하세요" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>연락처 *</label>
                  <input name="recipientPhone" value={form.recipientPhone}
                    onChange={(e) => setForm(f => ({ ...f, recipientPhone: formatPhone(e.target.value) }))}
                    placeholder="010-0000-0000" required style={inputStyle} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>주소 *</label>
                  <input name="addressZipcode" value={form.addressZipcode} onChange={handleInput}
                    placeholder="우편번호" required style={{ ...inputStyle, marginBottom: "0.5rem" }} />
                  <input name="addressMain" value={form.addressMain} onChange={handleInput}
                    placeholder="기본 주소" required style={{ ...inputStyle, marginBottom: "0.5rem" }} />
                  <input name="addressDetail" value={form.addressDetail} onChange={handleInput}
                    placeholder="상세 주소 (선택)" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>배송 메모</label>
                  <select name="deliveryMemo" value={form.deliveryMemo}
                    onChange={handleInput} style={inputStyle}>
                    <option value="">선택 안함</option>
                    <option value="문 앞에 놔주세요">문 앞에 놔주세요</option>
                    <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
                    <option value="부재 시 연락 부탁드려요">부재 시 연락 부탁드려요</option>
                    <option value="직접 수령할게요">직접 수령할게요</option>
                  </select>
                </div>
              </div>
            </section>

            {/* 쿠폰 및 포인트 사용 */}
            <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1.25rem", color: "var(--mb-gray-900)" }}>
                쿠폰 / 포인트 할인
              </h2>
              
              {/* 쿠폰 선택 */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>쿠폰 선택</label>
                {coupons.length === 0 ? (
                  <select disabled style={{ ...inputStyle, background: "var(--mb-gray-50)", color: "var(--mb-gray-400)" }}>
                    <option>사용 가능한 쿠폰이 없습니다.</option>
                  </select>
                ) : (
                  <select
                    value={selectedCoupon?.userCouponId || ""}
                    onChange={(e) => {
                      const cid = e.target.value;
                      const selected = coupons.find((c) => c.userCouponId === cid);
                      setSelectedCoupon(selected || null);
                    }}
                    style={inputStyle}
                  >
                    <option value="">쿠폰 선택 안 함</option>
                    {coupons.map((c) => (
                      <option key={c.userCouponId} value={c.userCouponId}>
                        {c.name} ({c.discountType === "fixed" ? `${c.discountValue.toLocaleString()}원` : `${c.discountValue}%`} 할인)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 포인트 입력 */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                  <label style={{ ...labelStyle, margin: 0 }}>포인트 사용 (상품 1만원 이상 구매 시, 최대 30% 한도)</label>
                  <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
                    보유: {maxAvailablePoints.toLocaleString()}P
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="number"
                    value={pointInput}
                    onChange={(e) => setPointInput(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (subtotal < 10000) {
                        alert("포인트는 상품 합계 금액이 10,000원 이상일 때만 사용 가능합니다.");
                        return;
                      }
                      const pts = parseInt(pointInput) || 0;
                      if (pts > maxAvailablePoints) {
                        alert("보유하신 포인트보다 큰 금액은 사용할 수 없습니다.");
                        return;
                      }
                      if (pts > 0 && pts < 1000) {
                        alert("포인트는 최소 1,000P 이상 사용 가능합니다.");
                        return;
                      }
                      if (pts > maxPointsToUse) {
                        alert(`해당 주문에서 적용 가능한 최대 포인트는 상품 총액의 30%인 ${maxPointsToUse.toLocaleString()}P 입니다.`);
                        return;
                      }
                      setAppliedPoints(pts);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "10px",
                      border: "1px solid var(--mb-gray-300)",
                      background: "#fff",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    적용
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (subtotal < 10000) {
                        alert("포인트는 상품 합계 금액이 10,000원 이상일 때만 사용 가능합니다.");
                        return;
                      }
                      if (maxAvailablePoints < 1000) {
                        alert("포인트는 최소 1,000P 이상부터 사용 가능합니다.");
                        return;
                      }
                      if (maxPointsToUse < 1000) {
                        alert("본 주문에서 사용 가능한 최대 포인트(상품 총액의 30%)가 1,000P 미만입니다.");
                        return;
                      }
                      const allPoints = Math.min(maxAvailablePoints, maxPointsToUse);
                      setPointInput(allPoints.toString());
                      setAppliedPoints(allPoints);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "10px",
                      border: "none",
                      background: "var(--mb-gray-100)",
                      color: "var(--mb-gray-700)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    전액 사용
                  </button>
                </div>
                {appliedPoints > 0 && (
                  <p style={{ color: "var(--mb-pink-600)", fontSize: "0.8125rem", margin: "0.5rem 0 0 0", fontWeight: 600 }}>
                    ✓ {appliedPoints.toLocaleString()}P 할인이 적용되었습니다.
                  </p>
                )}
              </div>
            </section>

            {/* 결제 금액 요약 */}
            <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", color: "var(--mb-gray-900)" }}>
                결제 금액
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--mb-gray-700)" }}>
                  <span>상품 금액</span><span>{fmt(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--mb-gray-700)" }}>
                  <span>배송비</span>
                  <span>{shippingFee === 0 ? <span style={{ color: "var(--mb-pink-500)" }}>무료</span> : fmt(shippingFee)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--mb-pink-600)" }}>
                    <span>쿠폰 할인</span><span>-{fmt(couponDiscount)}</span>
                  </div>
                )}
                {actualPointDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--mb-pink-600)" }}>
                    <span>포인트 사용</span><span>-{actualPointDiscount.toLocaleString()}P</span>
                  </div>
                )}
                <div style={{ height: "1px", background: "var(--mb-gray-100)", margin: "0.5rem 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", color: "var(--mb-gray-900)" }}>
                  <span>총 결제금액</span><span style={{ color: "var(--mb-pink-600)" }}>{fmt(finalTotal)}</span>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--mb-pink-400)", textAlign: "right" }}>
                  이 주문으로 {estimatedPoints.toLocaleString()}P 적립 예정
                </div>
              </div>
            </section>

            {error && <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0 }}>{error}</p>}

            <button type="submit" disabled={isSubmitting}
              style={{
                padding: "1rem", borderRadius: "14px", border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #db2777, #9333ea)",
                color: "#fff", fontSize: "1rem", fontWeight: 700,
                opacity: isSubmitting ? 0.7 : 1,
              }}>
              {isSubmitting ? "처리 중..." : `${fmt(finalTotal)} 결제하기`}
            </button>
          </form>
        )}

        {/* ── Step 2: 결제위젯 ── */}
        {step === "payment" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--mb-gray-500)" }}>주문번호</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--mb-gray-700)" }}>{orderNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.875rem", color: "var(--mb-gray-500)" }}>결제 금액</span>
                <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--mb-pink-600)" }}>{fmt(totalAmount)}</span>
              </div>
            </section>

            {/* 토스 결제위젯 렌더 영역 */}
            <div style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
              <div id="payment-method" ref={paymentRef} />
              <div id="payment-agreement" ref={agreementRef} style={{ marginTop: "1rem" }} />
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0 }}>{error}</p>}

            <button onClick={handlePayment} disabled={isSubmitting}
              style={{
                padding: "1rem", borderRadius: "14px", border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #db2777, #9333ea)",
                color: "#fff", fontSize: "1rem", fontWeight: 700,
                opacity: isSubmitting ? 0.7 : 1,
              }}>
              {isSubmitting ? "결제 처리 중..." : `${fmt(totalAmount)} 결제하기`}
            </button>

            <button onClick={() => setStep("address")}
              style={{
                padding: "0.75rem", borderRadius: "14px", border: "1px solid var(--mb-gray-200)",
                background: "transparent", color: "var(--mb-gray-600)", fontSize: "0.875rem",
                fontWeight: 600, cursor: "pointer",
              }}>
              ← 배송지 수정
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 스타일 상수
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8125rem", fontWeight: 600,
  color: "var(--mb-gray-700)", marginBottom: "0.375rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.625rem 0.875rem",
  border: "1px solid var(--mb-gray-200)", borderRadius: "10px",
  fontSize: "0.9375rem", color: "var(--mb-gray-900)",
  outline: "none", boxSizing: "border-box",
  background: "#fff",
};

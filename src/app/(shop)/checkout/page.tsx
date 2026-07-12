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

  const [isDirect, setIsDirect] = useState(false);
  const [directItemId, setDirectItemId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("direct") === "true") {
      setIsDirect(true);
      setDirectItemId(sessionStorage.getItem("direct_checkout_item_id"));
    }
    setIsLoaded(true);
  }, []);

  const checkoutItems = (isDirect && directItemId)
    ? items.filter((item) => item.id === directItemId)
    : items;

  // 배송지 폼
  const [form, setForm] = useState({
    recipientName: masterUser?.name ?? "",
    recipientPhone: "",
    addressZipcode: "",
    addressMain: "",
    addressDetail: "",
    deliveryMemo: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [error, setError] = useState("");
  
  // 결제 수단 선택 상태 (CARD가 기본)
  const [paymentMethod, setPaymentMethod] = useState("CARD");

  // 포인트 및 쿠폰 관련 상태
  const [coupons, setCoupons] = useState<any[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<any | null>(null);
  const [pointInput, setPointInput] = useState("");
  const [appliedPoints, setAppliedPoints] = useState(0);

  // 멤버십 등급 할인
  const [membershipInfo, setMembershipInfo] = useState<{
    currentTier: { id: string; name: string; badge_emoji: string; discount_rate: number };
  } | null>(null);

  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      fetch("/api/membership")
        .then((r) => r.json())
        .then((res) => { if (res.success) setMembershipInfo(res.data); })
        .catch(() => {});
    }
  }, [isLoggedIn, authLoading]);

  // 메인 금액 계산
  const subtotal = checkoutItems.reduce((s, i) => s + i.subtotal, 0);
  const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;

  // 회원 등급 할인 (자동 적용)
  const membershipDiscountRate = membershipInfo?.currentTier?.discount_rate ?? 0;
  const membershipDiscount = membershipDiscountRate > 0 ? Math.floor(subtotal * (membershipDiscountRate / 100)) : 0;

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
  const maxPointsToUse = Math.min(maxPointsAllowed, Math.max(0, subtotal - membershipDiscount - couponDiscount));
  const actualPointDiscount = Math.min(appliedPoints, maxPointsToUse);

  const finalTotal = Math.max(0, subtotal + shippingFee - membershipDiscount - actualPointDiscount - couponDiscount);
  const estimatedPoints = Math.floor(finalTotal * POINT_REWARD_RATE);

  // 비로그인 처리
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace("/login?redirect=/checkout");
    }
  }, [authLoading, isLoggedIn, router]);

  // 장바구니 비어있는 경우
  useEffect(() => {
    if (isLoaded && !authLoading && checkoutItems.length === 0) {
      router.replace("/cart");
    }
  }, [isLoaded, authLoading, checkoutItems.length, router]);

  // 기존 토스 위젯용 useEffect 들 제거 완료

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

  const paymentRef = useRef<HTMLDivElement>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

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

  // masterUser 정보 로드 시 배송지 폼에 자동 입력
  useEffect(() => {
    if (masterUser) {
      setForm((f) => ({
        ...f,
        recipientName: f.recipientName || masterUser.shipping_recipient || masterUser.name || "",
        recipientPhone: f.recipientPhone || formatPhone(masterUser.shipping_phone || masterUser.phoneNumber || ""),
        addressZipcode: f.addressZipcode || masterUser.shipping_zipcode || "",
        addressMain: f.addressMain || masterUser.shipping_address || "",
        addressDetail: f.addressDetail || masterUser.shipping_detail || "",
      }));
    }
  }, [masterUser]);

  const handleAddressSearch = () => {
    const scriptId = "daum-postcode-script";
    const existingScript = document.getElementById(scriptId);

    const openPostcode = () => {
      if ((window as any).daum && (window as any).daum.Postcode) {
        new (window as any).daum.Postcode({
          oncomplete: (data: any) => {
            let fullAddress = data.address;
            let extraAddress = "";
            if (data.addressType === "R") {
              if (data.bname !== "") extraAddress += data.bname;
              if (data.buildingName !== "") extraAddress += (extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName);
              fullAddress += (extraAddress !== "" ? ` (${extraAddress})` : "");
            }
            setForm((f) => ({
              ...f,
              addressZipcode: data.zonecode,
              addressMain: fullAddress,
            }));
          },
        }).open();
      }
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      script.onload = openPostcode;
      document.head.appendChild(script);
    } else {
      openPostcode();
    }
  };

  // 1-Page 결제하기 버튼 클릭: 주문 생성 후 곧바로 토스 결제창 호출
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.recipientName || !form.recipientPhone || !form.addressZipcode || !form.addressMain) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 만약 "기본 배송지로 저장" 체크박스가 체크되어 있다면 im-core-auth에 업데이트 수행!
      if (saveAsDefault && masterUser?.masterUserId) {
        await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            masterUserId: masterUser.masterUserId,
            shipping_recipient: form.recipientName,
            shipping_phone: form.recipientPhone,
            shipping_zipcode: form.addressZipcode,
            shipping_address: form.addressMain,
            shipping_detail: form.addressDetail,
          }),
        });

        // 로컬 auth state/store의 masterUser 정보도 즉시 갱신
        const updatedUser = {
          ...masterUser,
          shipping_recipient: form.recipientName,
          shipping_phone: form.recipientPhone,
          shipping_zipcode: form.addressZipcode,
          shipping_address: form.addressMain,
          shipping_detail: form.addressDetail,
        };
        useAuthStore.getState().setMasterUser(updatedUser);
      }
      // 1. 주문 상품 객체 생성
      const orderItems = checkoutItems.map((item) => {
        return {
          productId: item.product?.id,
          variantId: item.variant?.id ?? null,
          productName: item.product?.name ?? "상품",
          variantInfo: item.variant?.optionValues ?? null,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        };
      });

      // 2. 주문 레코드 생성 API 호출
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

      if (saveAsDefault) {
        sessionStorage.setItem("save_address_on_success", JSON.stringify({
          zipcode: form.addressZipcode,
          address: form.addressMain,
          detail: form.addressDetail,
          recipient: form.recipientName,
          phone: form.recipientPhone
        }));
      } else {
        sessionStorage.removeItem("save_address_on_success");
      }

      // 3. 토스페이먼츠 SDK 동적 로드 및 결제창(requestPayment) 직접 호출!
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const cleanClientKey = (process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F]/g, "");
      const tossPayments = await loadTossPayments(cleanClientKey);

      const orderTitle = checkoutItems.length === 1
        ? (checkoutItems[0].product?.name ?? "상품")
        : `${checkoutItems[0].product?.name ?? "상품"} 외 ${checkoutItems.length - 1}건`;

      const payment = tossPayments.payment({
        customerKey: masterUser?.masterUserId ?? "GUEST",
      });

      await payment.requestPayment({
        method: paymentMethod as any,
        amount: { currency: "KRW", value: data.totalAmount },
        orderId: data.orderId,
        orderName: orderTitle,
        successUrl: `${window.location.origin}/checkout/success?orderNumber=${data.orderNumber}`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: `${masterUser?.phoneNumber || "user"}@modelbeauty.kr`,
        customerName: form.recipientName,
        customerMobilePhone: form.recipientPhone.replace(/-/g, ""),
      });

    } catch (err) {
      console.error("결제 진행 중 실패:", err);
      // 사용자가 결제창을 취소(닫기)한 경우는 에러로 간주하지 않고 멈춤
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "USER_CANCEL") {
        return;
      }
      setError("결제 요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
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

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr" }}>
        <form onSubmit={handleAddressSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* 주문 상품 요약 */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", color: "var(--mb-gray-900)" }}>
              주문 상품 ({checkoutItems.length}개)
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {checkoutItems.map((item) => (
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
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <input name="addressZipcode" value={form.addressZipcode} readOnly onClick={handleAddressSearch}
                    placeholder="우편번호" required style={{ ...inputStyle, flex: 1, margin: 0, background: "var(--mb-gray-50)", cursor: "pointer" }} />
                  <button type="button" onClick={handleAddressSearch}
                    style={{
                      background: "var(--mb-gray-800)", color: "#fff", border: "none", borderRadius: "10px",
                      padding: "0 1rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer"
                    }}>검색</button>
                </div>
                <input name="addressMain" value={form.addressMain} readOnly onClick={handleAddressSearch}
                  placeholder="기본 주소" required style={{ ...inputStyle, marginBottom: "0.5rem", background: "var(--mb-gray-50)", cursor: "pointer" }} />
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                <input
                  type="checkbox"
                  id="saveAsDefault"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="saveAsDefault" style={{ fontSize: "0.875rem", color: "var(--mb-gray-700)", cursor: "pointer", fontWeight: 500 }}>
                  입력한 주소를 기본 주소로 저장
                </label>
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

          {/* ── 결제수단 선택 영역 (표준 결제창 호출용 라디오 버튼) ── */}
          <section style={{ background: "#fff", borderRadius: "16px", padding: "1.25rem", border: "1px solid var(--mb-gray-100)" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1.25rem", color: "var(--mb-gray-900)" }}>
              결제 수단 선택
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.9375rem", cursor: "pointer", fontWeight: 500, color: "var(--mb-gray-800)" }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CARD"
                  checked={paymentMethod === "CARD"}
                  onChange={() => setPaymentMethod("CARD")}
                  style={{ width: "18px", height: "18px", accentColor: "var(--mb-pink-500)" }}
                />
                💳 신용카드 / 간편결제 (Toss, Naver, Kakao 등)
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.9375rem", cursor: "pointer", fontWeight: 500, color: "var(--mb-gray-800)" }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="TRANSFER"
                  checked={paymentMethod === "TRANSFER"}
                  onChange={() => setPaymentMethod("TRANSFER")}
                  style={{ width: "18px", height: "18px", accentColor: "var(--mb-pink-500)" }}
                />
                🏦 실시간 계좌이체
              </label>
              
              <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.9375rem", cursor: "pointer", fontWeight: 500, color: "var(--mb-gray-800)" }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value="VIRTUAL_ACCOUNT"
                  checked={paymentMethod === "VIRTUAL_ACCOUNT"}
                  onChange={() => setPaymentMethod("VIRTUAL_ACCOUNT")}
                  style={{ width: "18px", height: "18px", accentColor: "var(--mb-pink-500)" }}
                />
                💸 가상계좌 (무통장 입금)
              </label>
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
              {membershipDiscount > 0 && membershipInfo && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#9333ea" }}>
                  <span>🏆 {membershipInfo.currentTier.name} 등급 할인 ({membershipInfo.currentTier.discount_rate}%)</span>
                  <span>-{fmt(membershipDiscount)}</span>
                </div>
              )}
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

          {error && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0, fontWeight: 600 }}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={isSubmitting}
            style={{
              padding: "1rem", borderRadius: "14px", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #db2777, #9333ea)",
              color: "#fff", fontSize: "1rem", fontWeight: 700,
              opacity: isSubmitting ? 0.7 : 1,
            }}>
            {isSubmitting ? "결제 진행 중..." : `${fmt(finalTotal)} 결제하기`}
          </button>
        </form>
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

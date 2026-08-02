"use client";

// ============================================================
// /mypage — 마이페이지 홈 (프로필 요약 + 최근 주문)
// ============================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWishlistStore } from "@/store/wishlist.store";
import OrderCard from "@/components/mypage/OrderCard";
import type { OrderStatus } from "@/types";

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  firstItem: {
    productName: string;
    variantInfo: Record<string, string> | null;
    quantity: number;
    imageUrl: string | null;
    slug: string | null;
  } | null;
  shippingInfo?: {
    carrierName: string;
    trackingNumber: string;
    shippedAt: string;
    deliveredAt: string | null;
  } | null;
}

export default function MypagePage() {
  const { masterUser, setMasterUser } = useAuthStore();
  const { items: wishlistItems } = useWishlistStore();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // 닉네임 수정
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

  // 멤버십 등급
  const [membershipInfo, setMembershipInfo] = useState<{
    currentTier: { id: string; name: string; badge_emoji: string; discount_rate: number; min_amount: number };
    nextTier: { id: string; name: string; badge_emoji: string; min_amount: number } | null;
    totalPurchasedLast6m: number;
    amountToNextTier: number;
    isLocked: boolean;
  } | null>(null);

  // 주소 수정 상태
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressState, setAddressState] = useState({
    recipient: masterUser?.shipping_recipient ?? masterUser?.name ?? "",
    phone: masterUser?.shipping_phone ?? masterUser?.phoneNumber ?? "",
    zipcode: masterUser?.shipping_zipcode ?? "",
    address: masterUser?.shipping_address ?? "",
    detail: masterUser?.shipping_detail ?? "",
  });
  const [addressError, setAddressError] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // 프로필(생년월일/성별/마케팅 동의) 수정 상태
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileState, setProfileState] = useState({
    birthYear: "", birthMonth: "", birthDay: "",
    gender: "" as "" | "male" | "female" | "other",
    marketingEmail: false, marketingSms: false,
  });

  // 회원 탈퇴(계정 삭제) 상태 변수
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAgree, setWithdrawAgree] = useState(false);

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  };

  // 1. masterUser 로드 시 기본 주소 상태 셋업 (수정 중이 아닐 때만)
  useEffect(() => {
    if (masterUser && !isEditingAddress) {
      setAddressState({
        recipient: masterUser.shipping_recipient ?? masterUser.name ?? "",
        phone: masterUser.shipping_phone ?? masterUser.phoneNumber ?? "",
        zipcode: masterUser.shipping_zipcode ?? "",
        address: masterUser.shipping_address ?? "",
        detail: masterUser.shipping_detail ?? "",
      });
    }
  }, [masterUser, isEditingAddress]);

  // 2. 멤버십 등급 조회 (최초 1회 실행)
  useEffect(() => {
    if (masterUser) {
      fetch("/api/membership")
        .then((r) => r.json())
        .then((res) => { if (res.success) setMembershipInfo(res.data); })
        .catch(() => {});
    }
  }, [masterUser ? masterUser.masterUserId : null]);

  // 3. 프로필(생년월일/성별/마케팅 동의) 조회
  useEffect(() => {
    if (!masterUser) return;
    fetch("/api/mypage/profile")
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) return;
        const [y, m, d] = (res.data.birthDate ?? "").split("-");
        setProfileState({
          birthYear: y ?? "",
          birthMonth: m ?? "",
          birthDay: d ?? "",
          gender: res.data.gender ?? "",
          marketingEmail: !!res.data.marketingEmail,
          marketingSms: !!res.data.marketingSms,
        });
      })
      .catch(() => {});
  }, [masterUser ? masterUser.masterUserId : null]);

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
            setAddressState((prev) => ({
              ...prev,
              address: fullAddress,
              zipcode: data.zonecode,
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

  const handleAddressSave = async () => {
    if (!addressState.recipient.trim()) {
      setAddressError("수령인은 필수 입력 항목입니다.");
      return;
    }
    if (!addressState.phone.trim()) {
      setAddressError("연락처는 필수 입력 항목입니다.");
      return;
    }
    if (!addressState.zipcode.trim() || !addressState.address.trim()) {
      setAddressError("주소는 필수 입력 항목입니다.");
      return;
    }

    setIsSavingAddress(true);
    setAddressError("");

    try {
      const res = await fetch("/api/auth/sync", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: masterUser?.masterUserId,
          shipping_recipient: addressState.recipient,
          shipping_phone: addressState.phone.replace(/-/g, ""),
          shipping_zipcode: addressState.zipcode,
          shipping_address: addressState.address,
          shipping_detail: addressState.detail,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        if (masterUser) {
          setMasterUser({
            ...masterUser,
            shipping_zipcode: updated.shipping_zipcode,
            shipping_address: updated.shipping_address,
            shipping_detail: updated.shipping_detail,
            shipping_recipient: updated.shipping_recipient,
            shipping_phone: updated.shipping_phone,
          });
        }
        setIsEditingAddress(false);
      } else {
        setAddressError("주소 저장에 실패했습니다.");
      }
    } catch {
      setAddressError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSaveProfile = async () => {
    const { birthYear, birthMonth, birthDay, gender, marketingEmail, marketingSms } = profileState;

    if ((birthYear || birthMonth || birthDay) && !(birthYear && birthMonth && birthDay)) {
      setProfileError("생년월일은 년/월/일을 모두 선택해 주세요.");
      return;
    }

    const birthDate = birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, "0")}-${birthDay.padStart(2, "0")}`
      : null;

    setIsSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch("/api/mypage/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate, gender: gender || null, marketingEmail, marketingSms }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditingProfile(false);
      } else {
        setProfileError(data.error ?? "저장에 실패했습니다.");
      }
    } catch {
      setProfileError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartEditAddress = () => {
    if (masterUser) {
      setAddressState({
        recipient: masterUser.shipping_recipient ?? masterUser.name ?? "",
        phone: masterUser.shipping_phone ?? masterUser.phoneNumber ?? "",
        zipcode: masterUser.shipping_zipcode ?? "",
        address: masterUser.shipping_address ?? "",
        detail: masterUser.shipping_detail ?? "",
      });
    }
    setAddressError("");
    setIsEditingAddress(true);
  };

  useEffect(() => {
    fetch("/api/mypage/orders?page=1")
      .then((r) => r.json())
      .then(({ data }) => {
        setRecentOrders((data?.orders ?? []).slice(0, 3));
        setOrderCount(data?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setIsLoadingOrders(false));
  }, []);

  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      setIsLoggingOut(true);
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (res.ok) {
          setMasterUser(null);
          window.location.href = "/";
        }
      } catch {
        alert("로그아웃 중 오류가 발생했습니다.");
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAgree) {
      alert("탈퇴 유의사항을 확인하고 동의 체크박스에 동의해 주세요.");
      return;
    }

    setIsWithdrawing(true);
    try {
      const res = await fetch("/api/auth/withdraw", { method: "POST" });
      const data = await res.json();
      
      if (res.ok && data.success) {
        alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
        setMasterUser(null);
        window.location.href = "/";
      } else {
        alert(data.error || "회원 탈퇴 처리 중 오류가 발생했습니다. 고객센터로 문의 바랍니다.");
      }
    } catch (e) {
      console.error(e);
      alert("네트워크 통신 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setIsWithdrawing(false);
      setIsWithdrawOpen(false);
    }
  };

  const handleNicknameEdit = () => {
    setNicknameInput(masterUser?.name ?? "");
    setNicknameError("");
    setIsEditingNickname(true);
  };

  const handleNicknameSave = async () => {
    const trimmed = nicknameInput.trim();
    if (trimmed.length < 2) { setNicknameError("닉네임은 2자 이상이어야 합니다."); return; }
    if (trimmed.length > 12) { setNicknameError("닉네임은 12자 이하이어야 합니다."); return; }
    setIsSavingNickname(true);
    try {
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: masterUser?.masterUserId,
          name: trimmed,
        }),
      });
      if (res.ok) {
        // 로컈 스토어도 즉시 반영
        if (masterUser) setMasterUser({ ...masterUser, name: trimmed });
        setIsEditingNickname(false);
      } else {
        setNicknameError("저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch {
      setNicknameError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSavingNickname(false);
    }
  };

  const points = masterUser?.integratedPoints ?? 0;

  const SUMMARY = [
    {
      href: "/mypage/orders",
      icon: "📦",
      value: orderCount,
      label: "주문 내역",
      suffix: "건",
    },
    {
      href: "/mypage/points",
      icon: "✨",
      value: points.toLocaleString("ko-KR"),
      label: "보유 포인트",
      suffix: "P",
    },
    {
      href: "/mypage/wishlist",
      icon: "❤️",
      value: wishlistItems.length,
      label: "위시리스트",
      suffix: "개",
    },
    {
      href: "/cart",
      icon: "🛒",
      value: "장바구니",
      label: "쇼핑 계속하기",
      suffix: "",
    },
  ];

  return (
    <>
      {/* 배송지 누락 연동 회원 경고 배너 */}
      {masterUser && (!masterUser.shipping_address || !masterUser.shipping_zipcode) && (
        <div style={{
          background: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
          border: "1px solid #fbcfe8",
          borderRadius: "16px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          boxShadow: "0 4px 12px rgba(219, 39, 119, 0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{ fontSize: "1.5rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: "#9d174d" }}>배송 정보 기입 필요</div>
              <div style={{ fontSize: "0.8125rem", color: "#be185d", marginTop: 2 }}>
                모델뷰티 쇼핑몰에서 상품을 주문하시려면 배송지 주소와 연락처 정보가 필수적입니다.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              handleStartEditAddress();
              setTimeout(() => {
                document.getElementById("address-card-section")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            style={{
              alignSelf: "flex-start",
              background: "var(--mb-pink-500)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "0.5rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 6px rgba(236, 72, 153, 0.3)"
            }}
          >
            지금 배송지 주소 등록하기 ➔
          </button>
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div>
          {isEditingNickname ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  maxLength={12}
                  autoFocus
                  style={{
                    fontSize: "1rem", fontWeight: 700,
                    border: "2px solid var(--mb-pink-400)",
                    borderRadius: "8px", padding: "0.375rem 0.625rem",
                    outline: "none", width: "140px",
                  }}
                />
                <button
                  onClick={handleNicknameSave}
                  disabled={isSavingNickname}
                  style={{
                    background: "var(--mb-pink-500)", color: "#fff",
                    border: "none", borderRadius: "8px",
                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                    fontWeight: 600, cursor: "pointer"
                  }}
                >{isSavingNickname ? "저장 중" : "확인"}</button>
                <button
                  onClick={() => setIsEditingNickname(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--mb-gray-300)",
                    borderRadius: "8px", padding: "0.375rem 0.625rem",
                    fontSize: "0.8125rem", cursor: "pointer", color: "var(--mb-gray-500)"
                  }}
                >취소</button>
              </div>
              {nicknameError && <p style={{ color: "#ef4444", fontSize: "0.8125rem", margin: 0 }}>{nicknameError}</p>}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <h1 className="mypage-section-title" style={{ margin: 0 }}>
                안녕하세요, {masterUser?.name ?? "회원"}님 👋
              </h1>
              <button
                onClick={handleNicknameEdit}
                title="닉네임 변경"
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", fontSize: "0.875rem",
                  color: "var(--mb-gray-400)", padding: "0.25rem",
                  lineHeight: 1,
                }}
              >✏️</button>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            background: "transparent",
            border: "1px solid var(--mb-gray-300)",
            color: "var(--mb-gray-600)",
            padding: "0.5rem 0.875rem",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>

      {/* 회원 탈퇴(계정 삭제) 비동기 제출 핸들러 */}
      {async () => {}} {/* 타입 인터페이스용 구조 주입 대비 */}

      {/* 요약 카드 그리드 */}
      <div className="mypage-summary-grid">
        {SUMMARY.map((item) => (
          <Link key={item.href} href={item.href} className="mypage-summary-card">
            <div className="mypage-summary-icon" aria-hidden="true">
              {item.icon}
            </div>
            <div className="mypage-summary-value">
              {item.value}
              {item.suffix && (
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--mb-gray-400)",
                    marginLeft: "2px",
                  }}
                >
                  {item.suffix}
                </span>
              )}
            </div>
            <div className="mypage-summary-label">{item.label}</div>
          </Link>
        ))}
      </div>

      {/* 멤버십 등급 배지 카드 */}
      {membershipInfo && (
        <div style={{
          background: "linear-gradient(135deg, rgba(var(--mb-pink-rgb,236,72,153),0.08), rgba(168,85,247,0.06))",
          border: "1px solid rgba(var(--mb-pink-rgb,236,72,153),0.18)",
          borderRadius: 16, padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <span style={{ fontSize: "2rem" }}>{membershipInfo.currentTier.badge_emoji}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.0625rem" }}>{membershipInfo.currentTier.name} 등급</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", marginTop: 2 }}>
                  {membershipInfo.currentTier.discount_rate > 0
                    ? `전 상품 ${membershipInfo.currentTier.discount_rate}% 할인 혜택`
                    : "등급 현황을 유지하세요"}
                </div>
              </div>
            </div>
            {membershipInfo.nextTier && (
              <div style={{ textAlign: "right", fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
                <div>다음 등급: <strong style={{ color: "var(--mb-gray-700)" }}>{membershipInfo.nextTier.badge_emoji} {membershipInfo.nextTier.name}</strong></div>
                <div style={{ marginTop: 2 }}><strong style={{ color: "var(--mb-pink-500)" }}>{membershipInfo.amountToNextTier.toLocaleString()}원</strong> 더 구매하면 승급</div>
              </div>
            )}
          </div>
          {membershipInfo.nextTier && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--mb-gray-400)", marginBottom: 6 }}>
                <span>6개월 구매액: {membershipInfo.totalPurchasedLast6m.toLocaleString()}원</span>
                <span>{membershipInfo.nextTier.name} 목표: {membershipInfo.nextTier.min_amount.toLocaleString()}원</span>
              </div>
              <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (membershipInfo.totalPurchasedLast6m / membershipInfo.nextTier.min_amount) * 100)}%`,
                  background: "linear-gradient(90deg, var(--mb-pink-400), #a855f7)",
                  borderRadius: 99, transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 내 주소 설정 카드 */}
      <div 
        id="address-card-section"
        style={{
          background: "#fff",
          borderRadius: "20px",
          padding: "1.5rem",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
          border: masterUser && (!masterUser.shipping_address || !masterUser.shipping_zipcode)
            ? "2px solid var(--mb-pink-500)"
            : "1px solid var(--mb-gray-100)",
          marginBottom: "2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: 0 }}>
            내 주소 설정 <span style={{ color: "var(--mb-pink-500)", fontSize: "0.8rem", fontWeight: 600 }}>(필수)</span>
          </h2>
          {!isEditingAddress && (
            <button
              onClick={handleStartEditAddress}
              style={{
                background: "var(--mb-pink-500)", color: "#fff",
                border: "none", borderRadius: "8px",
                padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                fontWeight: 600, cursor: "pointer"
              }}
            >수정</button>
          )}
        </div>

        {isEditingAddress ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="수령인 *"
                value={addressState.recipient}
                onChange={(e) => setAddressState(prev => ({ ...prev, recipient: e.target.value }))}
                style={{
                  flex: "1",
                  border: "1px solid var(--mb-gray-300)",
                  borderRadius: "8px", padding: "0.5rem",
                  fontSize: "0.875rem", outline: "none"
                }}
              />
              <input
                type="text"
                placeholder="연락처 * (010-0000-0000)"
                value={addressState.phone}
                onChange={(e) => setAddressState(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                style={{
                  flex: "1",
                  border: "1px solid var(--mb-gray-300)",
                  borderRadius: "8px", padding: "0.5rem",
                  fontSize: "0.875rem", outline: "none"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="우편번호"
                value={addressState.zipcode}
                readOnly
                onClick={handleAddressSearch}
                style={{
                  flex: "1",
                  border: "1px solid var(--mb-gray-300)",
                  borderRadius: "8px", padding: "0.5rem",
                  fontSize: "0.875rem", outline: "none",
                  background: "var(--mb-gray-50)", cursor: "pointer"
                }}
              />
              <button
                type="button"
                onClick={handleAddressSearch}
                style={{
                  background: "var(--mb-gray-800)", color: "#fff",
                  border: "none", borderRadius: "8px",
                  padding: "0.5rem 1rem", fontSize: "0.8125rem",
                  fontWeight: 600, cursor: "pointer"
                }}
              >우편번호 검색</button>
            </div>
            <input
              type="text"
              placeholder="기본 주소"
              value={addressState.address}
              readOnly
              onClick={handleAddressSearch}
              style={{
                border: "1px solid var(--mb-gray-300)",
                borderRadius: "8px", padding: "0.5rem",
                fontSize: "0.875rem", outline: "none",
                background: "var(--mb-gray-50)", cursor: "pointer"
              }}
            />
            <input
              type="text"
              placeholder="상세 주소"
              value={addressState.detail}
              onChange={(e) => setAddressState(prev => ({ ...prev, detail: e.target.value }))}
              style={{
                border: "1px solid var(--mb-gray-300)",
                borderRadius: "8px", padding: "0.5rem",
                fontSize: "0.875rem", outline: "none"
              }}
            />
            {addressError && <p style={{ color: "#ef4444", fontSize: "0.8125rem", margin: 0 }}>{addressError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                onClick={handleAddressSave}
                disabled={isSavingAddress}
                style={{
                  background: "var(--mb-pink-500)", color: "#fff",
                  border: "none", borderRadius: "8px",
                  padding: "0.5rem 1rem", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer", flex: 1
                }}
              >{isSavingAddress ? "저장 중..." : "저장"}</button>
              <button
                onClick={() => {
                  setIsEditingAddress(false);
                  if (masterUser) {
                    setAddressState({
                      recipient: masterUser.shipping_recipient ?? masterUser.name ?? "",
                      phone: masterUser.shipping_phone ?? masterUser.phoneNumber ?? "",
                      zipcode: masterUser.shipping_zipcode ?? "",
                      address: masterUser.shipping_address ?? "",
                      detail: masterUser.shipping_detail ?? "",
                    });
                  }
                }}
                style={{
                  background: "#fff", color: "var(--mb-gray-600)",
                  border: "1px solid var(--mb-gray-300)", borderRadius: "8px",
                  padding: "0.5rem 1rem", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer"
                }}
              >취소</button>
            </div>
          </div>
        ) : (
          <div>
            {addressState.address ? (
              <div style={{ fontSize: "0.875rem", color: "var(--mb-gray-700)", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 0.25rem 0" }}><span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[수령인]</span> {addressState.recipient} ({formatPhone(addressState.phone)})</p>
                <p style={{ margin: "0 0 0.25rem 0" }}><span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[우편번호]</span> {addressState.zipcode}</p>
                <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[주소]</span> {addressState.address} {addressState.detail}</p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "1rem 0" }}>
                <p style={{ color: "var(--mb-gray-400)", fontSize: "0.875rem", margin: "0 0 0.75rem 0" }}>등록된 주소가 없습니다. 필수 정보이오니 등록해주세요.</p>
                <button
                  onClick={handleStartEditAddress}
                  style={{
                    background: "transparent", color: "var(--mb-pink-500)",
                    border: "1px solid var(--mb-pink-500)", borderRadius: "8px",
                    padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                    fontWeight: 600, cursor: "pointer"
                  }}
                >주소 등록</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 프로필 정보 카드 (생년월일/성별/마케팅 동의) */}
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        padding: "1.5rem",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
        border: "1px solid var(--mb-gray-100)",
        marginBottom: "2rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: 0 }}>
            프로필 정보
          </h2>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              style={{
                background: "var(--mb-pink-500)", color: "#fff",
                border: "none", borderRadius: "8px",
                padding: "0.375rem 0.75rem", fontSize: "0.8125rem",
                fontWeight: 600, cursor: "pointer",
              }}
            >수정</button>
          )}
        </div>

        {isEditingProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <p style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", margin: "0 0 0.5rem 0" }}>
                🎂 생년월일을 등록하시면 매년 생일에 쿠폰을 보내드려요. (선택 입력)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr", gap: "0.5rem" }}>
                <select
                  value={profileState.birthYear}
                  onChange={(e) => setProfileState((prev) => ({ ...prev, birthYear: e.target.value }))}
                  style={{ border: "1px solid var(--mb-gray-300)", borderRadius: "8px", padding: "0.5rem", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}
                >
                  <option value="">출생 연도</option>
                  {Array.from({ length: new Date().getFullYear() - 14 - 1899 }, (_, i) => new Date().getFullYear() - 14 - i).map((y) => (
                    <option key={y} value={String(y)}>{y}년</option>
                  ))}
                </select>
                <select
                  value={profileState.birthMonth}
                  onChange={(e) => setProfileState((prev) => ({ ...prev, birthMonth: e.target.value }))}
                  style={{ border: "1px solid var(--mb-gray-300)", borderRadius: "8px", padding: "0.5rem", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}
                >
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>{m}월</option>
                  ))}
                </select>
                <select
                  value={profileState.birthDay}
                  onChange={(e) => setProfileState((prev) => ({ ...prev, birthDay: e.target.value }))}
                  style={{ border: "1px solid var(--mb-gray-300)", borderRadius: "8px", padding: "0.5rem", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}
                >
                  <option value="">일</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>{d}일</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p style={{ fontSize: "0.8125rem", color: "var(--mb-gray-500)", margin: "0 0 0.5rem 0" }}>성별 (선택)</p>
              <select
                value={profileState.gender}
                onChange={(e) => setProfileState((prev) => ({ ...prev, gender: e.target.value as typeof prev.gender }))}
                style={{ border: "1px solid var(--mb-gray-300)", borderRadius: "8px", padding: "0.5rem", fontSize: "0.875rem", outline: "none", cursor: "pointer", width: "100%" }}
              >
                <option value="">선택 안 함</option>
                <option value="female">여성</option>
                <option value="male">남성</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--mb-gray-700)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={profileState.marketingEmail}
                  onChange={(e) => setProfileState((prev) => ({ ...prev, marketingEmail: e.target.checked }))}
                  style={{ width: "16px", height: "16px", accentColor: "var(--mb-pink-500)", cursor: "pointer" }}
                />
                마케팅 정보 이메일 수신 동의
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--mb-gray-700)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={profileState.marketingSms}
                  onChange={(e) => setProfileState((prev) => ({ ...prev, marketingSms: e.target.checked }))}
                  style={{ width: "16px", height: "16px", accentColor: "var(--mb-pink-500)", cursor: "pointer" }}
                />
                마케팅 정보 SMS 수신 동의
              </label>
            </div>

            {profileError && <p style={{ color: "#ef4444", fontSize: "0.8125rem", margin: 0 }}>{profileError}</p>}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                style={{
                  background: "var(--mb-pink-500)", color: "#fff",
                  border: "none", borderRadius: "8px",
                  padding: "0.5rem 1rem", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer", flex: 1,
                }}
              >{isSavingProfile ? "저장 중..." : "저장"}</button>
              <button
                onClick={() => { setIsEditingProfile(false); setProfileError(""); }}
                style={{
                  background: "#fff", color: "var(--mb-gray-600)",
                  border: "1px solid var(--mb-gray-300)", borderRadius: "8px",
                  padding: "0.5rem 1rem", fontSize: "0.875rem",
                  fontWeight: 600, cursor: "pointer",
                }}
              >취소</button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.875rem", color: "var(--mb-gray-700)", lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[생년월일]</span>{" "}
              {profileState.birthYear && profileState.birthMonth && profileState.birthDay
                ? `${profileState.birthYear}년 ${profileState.birthMonth}월 ${profileState.birthDay}일`
                : <span style={{ color: "var(--mb-pink-500)" }}>미등록 — 등록하시면 생일 쿠폰을 받으실 수 있어요 🎂</span>}
            </p>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[성별]</span>{" "}
              {profileState.gender === "female" ? "여성" : profileState.gender === "male" ? "남성" : profileState.gender === "other" ? "기타" : "미등록"}
            </p>
            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 600, color: "var(--mb-gray-500)" }}>[마케팅 수신]</span>{" "}
              이메일 {profileState.marketingEmail ? "동의" : "미동의"} · SMS {profileState.marketingSms ? "동의" : "미동의"}
            </p>
          </div>
        )}
      </div>

      {/* 최근 주문 */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.0625rem",
              fontWeight: 800,
              color: "var(--mb-gray-900)",
              margin: 0,
            }}
          >
            최근 주문
          </h2>
          <Link
            href="/mypage/orders"
            style={{
              fontSize: "0.875rem",
              color: "var(--mb-pink-500)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            전체 보기 →
          </Link>
        </div>

        {isLoadingOrders ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: "160px", borderRadius: "20px" }}
              />
            ))}
          </div>
        ) : recentOrders.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recentOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="order-empty">
            <div className="order-empty-icon" aria-hidden="true">📦</div>
            <h3>아직 주문 내역이 없습니다</h3>
            <p>마음에 드는 상품을 구매해보세요!</p>
            <Link href="/products" className="hero-cta-primary">
              쇼핑하러 가기
            </Link>
          </div>
        )}
      </div>

      {/* 회원 탈퇴(계정 삭제) 버튼 링크 */}
      <div style={{ marginTop: "4rem", borderTop: "1px solid var(--mb-gray-100)", paddingTop: "1.5rem", textAlign: "right" }}>
        <button
          type="button"
          onClick={() => {
            setWithdrawAgree(false);
            setIsWithdrawOpen(true);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--mb-gray-400)",
            fontSize: "0.8125rem",
            textDecoration: "underline",
            cursor: "pointer",
            padding: "0.25rem"
          }}
        >
          회원 탈퇴 (계정 삭제)
        </button>
      </div>

      {/* 회원 탈퇴 안내 및 최종 동의 모달 */}
      {isWithdrawOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: "1rem"
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px", maxWidth: "480px",
            width: "100%", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
          }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--mb-gray-900)", margin: "0 0 1rem 0" }}>
              회원 탈퇴 안내 (계정 삭제)
            </h3>
            
            <div style={{
              background: "var(--mb-gray-50)", padding: "1rem", borderRadius: "12px",
              fontSize: "0.8125rem", lineHeight: "1.6", color: "var(--mb-gray-600)",
              marginBottom: "1.25rem", maxHeight: "240px", overflowY: "auto"
            }}>
              <p style={{ margin: "0 0 0.75rem 0", fontWeight: 700, color: "#ef4444" }}>
                ※ 탈퇴 전 반드시 아래 유의사항을 확인해 주시기 바랍니다.
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.15rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <li>탈퇴 시 고객님의 회원 정보와 위시리스트, 적립된 포인트 정보는 **즉시 영구 삭제되며 복구가 불가능**합니다.</li>
                <li>단, 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령의 규정에 의하여 **구매/결제 및 배송 관련 기록은 5년간 보관**된 후 자동으로 파기됩니다.</li>
                <li>이미 결제가 완료되어 배송 대기 중이거나 배송 중인 상품이 있는 경우, 배송 완료 후 탈퇴 처리가 완료됩니다.</li>
                <li>회원 탈퇴와 동시에 연동된 아임모델 공화국 통합 계정 정보의 모델뷰티 연동 내역이 해제되며, 기기 내의 로컬 로그인 토큰은 파기됩니다.</li>
              </ul>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <input
                type="checkbox"
                id="agree-withdraw"
                checked={withdrawAgree}
                onChange={(e) => setWithdrawAgree(e.target.checked)}
                style={{ cursor: "pointer", marginTop: "0.2rem" }}
              />
              <label htmlFor="agree-withdraw" style={{ fontSize: "0.8125rem", color: "var(--mb-gray-800)", cursor: "pointer", fontWeight: 600, lineHeight: "1.4" }}>
                안내 사항을 모두 확인하였으며, 이에 동의하고 계정을 영구 삭제하겠습니다.
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setIsWithdrawOpen(false)}
                disabled={isWithdrawing}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: "10px", border: "1px solid var(--mb-gray-200)",
                  background: "#fff", color: "var(--mb-gray-700)", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem"
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAgree}
                style={{
                  flex: 1, padding: "0.75rem", borderRadius: "10px", border: "none",
                  background: withdrawAgree ? "#ef4444" : "var(--mb-gray-300)",
                  color: "#fff", fontWeight: 700, cursor: withdrawAgree ? "pointer" : "not-allowed", fontSize: "0.875rem",
                  transition: "background 0.2s"
                }}
              >
                {isWithdrawing ? "탈퇴 처리 중..." : "회원 탈퇴"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

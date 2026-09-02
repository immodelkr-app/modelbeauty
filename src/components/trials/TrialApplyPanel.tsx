"use client";
// ============================================================
// TrialApplyPanel — 체험단 신청 버튼 + 모달 (Client Component)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth.store";

interface TrialApplyPanelProps {
  campaignId: string;
  isClosed: boolean;
  initialApplied: boolean;
}

const EMPTY_FORM = {
  applicantName: "",
  applicantPhone: "",
  addressZipcode: "",
  addressMain: "",
  addressDetail: "",
  youtubeChannel: "",
  instagramId: "",
  channelUrl: "",
  message: "",
};

export default function TrialApplyPanel({ campaignId, isClosed, initialApplied }: TrialApplyPanelProps) {
  const { isLoggedIn, masterUser } = useAuthStore();
  const [applied, setApplied] = useState(initialApplied);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const setF = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // 우편번호 검색: 앱 웹뷰에서 daum.Postcode의 .open()이 안드로이드 WebView의
  // onCreateWindow 처리와 충돌해 진행되지 않는 문제가 있어 .embed()로 페이지 내 모달에 그린다.
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const postcodeContainerRef = useRef<HTMLDivElement>(null);

  const handleAddressSearch = () => {
    const scriptId = "daum-postcode-script";
    const existingScript = document.getElementById(scriptId);
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      script.onload = () => setIsPostcodeOpen(true);
      document.head.appendChild(script);
    } else {
      setIsPostcodeOpen(true);
    }
  };

  useEffect(() => {
    if (!isPostcodeOpen || !postcodeContainerRef.current || !(window as any).daum?.Postcode) return;
    postcodeContainerRef.current.innerHTML = "";
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        let fullAddress = data.address;
        let extraAddress = "";
        if (data.addressType === "R") {
          if (data.bname !== "") extraAddress += data.bname;
          if (data.buildingName !== "") extraAddress += (extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName);
          fullAddress += (extraAddress !== "" ? ` (${extraAddress})` : "");
        }
        setForm((f) => ({ ...f, addressZipcode: data.zonecode, addressMain: fullAddress }));
        setIsPostcodeOpen(false);
      },
      width: "100%",
      height: "100%",
    }).embed(postcodeContainerRef.current);
  }, [isPostcodeOpen]);

  const handleOpen = () => {
    if (!isLoggedIn) {
      alert("로그인 후 신청할 수 있어요.");
      return;
    }
    setForm({
      ...EMPTY_FORM,
      applicantName: masterUser?.shipping_recipient || masterUser?.name || "",
      applicantPhone: masterUser?.shipping_phone || masterUser?.phoneNumber || "",
      addressZipcode: masterUser?.shipping_zipcode || "",
      addressMain: masterUser?.shipping_address || "",
      addressDetail: masterUser?.shipping_detail || "",
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.applicantName.trim() || !form.applicantPhone.trim() || !form.addressZipcode || !form.addressMain.trim()) {
      alert("이름, 연락처, 배송지 주소는 필수입니다.");
      return;
    }
    if (!form.youtubeChannel.trim() && !form.instagramId.trim() && !form.channelUrl.trim()) {
      alert("유튜브 채널, 인스타그램 아이디, 기타 링크 중 최소 하나는 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trials/${campaignId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName: form.applicantName.trim(),
          applicantPhone: form.applicantPhone.trim(),
          addressZipcode: form.addressZipcode.trim(),
          addressMain: form.addressMain.trim(),
          addressDetail: form.addressDetail.trim() || undefined,
          youtubeChannel: form.youtubeChannel.trim() || undefined,
          instagramId: form.instagramId.trim() || undefined,
          channelUrl: form.channelUrl.trim() || undefined,
          message: form.message.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert("신청이 완료되었습니다. 선정 결과는 앱 알림/문자로 안내드려요.");
        setApplied(true);
        setOpen(false);
      } else {
        alert(result.error ?? "신청에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px",
    padding: "0.65rem 0.75rem", fontSize: "0.875rem",
  };
  const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 700, marginBottom: "0.4rem" };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={applied || isClosed}
        style={{
          width: "100%",
          padding: "0.9rem",
          border: "none",
          borderRadius: "12px",
          fontSize: "1rem",
          fontWeight: 800,
          cursor: applied || isClosed ? "default" : "pointer",
          background: applied || isClosed ? "var(--mb-gray-100)" : "var(--mb-pink-600)",
          color: applied || isClosed ? "var(--mb-gray-500)" : "#fff",
        }}
      >
        {applied ? "✅ 신청 완료" : isClosed ? "모집 마감" : "체험단 신청하기"}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" }}
          >
            <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 800 }}>체험단 신청</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.8125rem", color: "var(--mb-gray-500)" }}>
              선정되면 이 정보로 제품을 발송하고 연락드려요. 참가비가 있는 캠페인은 선정된 분에게만 결제를 요청합니다.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <div style={labelStyle}>이름</div>
                <input value={form.applicantName} onChange={(e) => setF("applicantName", e.target.value)} placeholder="홍길동" style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>연락처</div>
                <input value={form.applicantPhone} onChange={(e) => setF("applicantPhone", e.target.value)} placeholder="010-0000-0000" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <div style={labelStyle}>배송지 주소</div>
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <input value={form.addressZipcode} readOnly onClick={handleAddressSearch} placeholder="우편번호" style={{ ...inputStyle, flex: 1, cursor: "pointer", background: "var(--mb-gray-50)" }} />
                <button type="button" onClick={handleAddressSearch} style={{ padding: "0 1rem", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", background: "#fff", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}>
                  주소 검색
                </button>
              </div>
              <input value={form.addressMain} readOnly onClick={handleAddressSearch} placeholder="기본 주소 (검색해주세요)" style={{ ...inputStyle, cursor: "pointer", background: "var(--mb-gray-50)", marginBottom: "0.4rem" }} />
              <input value={form.addressDetail} onChange={(e) => setF("addressDetail", e.target.value)} placeholder="상세 주소" style={inputStyle} />
            </div>

            {isPostcodeOpen && (
              <div
                onClick={() => setIsPostcodeOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", zIndex: 1100 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "14px", overflow: "hidden", width: "100%", maxWidth: 420, height: 480 }}>
                  <div ref={postcodeContainerRef} style={{ width: "100%", height: "100%" }} />
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "1rem 0 0.75rem" }}>
              <div>
                <div style={labelStyle}>유튜브 채널</div>
                <input value={form.youtubeChannel} onChange={(e) => setF("youtubeChannel", e.target.value)} placeholder="채널 URL 또는 @핸들" style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>인스타그램 아이디</div>
                <input value={form.instagramId} onChange={(e) => setF("instagramId", e.target.value)} placeholder="@아이디" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <div style={labelStyle}>블로그 등 기타 링크 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택)</span></div>
              <input value={form.channelUrl} onChange={(e) => setF("channelUrl", e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
            <p style={{ margin: "-0.4rem 0 1rem", fontSize: "0.75rem", color: "var(--mb-gray-400)" }}>
              유튜브·인스타·기타 링크 중 최소 하나는 입력해주세요.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <div style={labelStyle}>
                활동소개 <span style={{ fontWeight: 400, color: "var(--mb-gray-500)" }}>(선택)</span>
              </div>
              <textarea
                value={form.message}
                onChange={(e) => setF("message", e.target.value)}
                rows={3}
                placeholder="간단히 소개해주세요."
                style={{ width: "100%", border: "1px solid var(--mb-gray-200)", borderRadius: "10px", padding: "0.75rem", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setOpen(false)}
                style={{ flex: 1, padding: "0.75rem", border: "1px solid var(--mb-gray-200)", background: "#fff", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 2, padding: "0.75rem", border: "none", background: "var(--mb-pink-600)", color: "#fff", borderRadius: "10px", fontSize: "0.875rem", fontWeight: 700, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "신청 중..." : "신청하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

// ============================================================
// 회원가입 페이지 — 닉네임/비밀번호 기반 (강화판)
// 추가 필드: 생년월일, 성별, 주소(다음 우편번호), 약관/마케팅 동의
// ============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type NicknameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function SignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    nickname: "",
    realName: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    gender: "" as "" | "male" | "female" | "other",
    zipcode: "",
    address: "",
    addressDetail: "",
  });

  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    marketingEmail: false,
    marketingSms: false,
  });

  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [linkedAppsAlert, setLinkedAppsAlert] = useState("");

  // 전화번호 포맷팅
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  // 닉네임 실시간 중복 확인 (디바운스)
  useEffect(() => {
    const nick = form.nickname.trim();
    if (!nick) {
      setNicknameStatus("idle");
      setNicknameChecked(false);
      return;
    }
    if (nick.length < 2 || nick.length > 12) {
      setNicknameStatus("invalid");
      setNicknameChecked(false);
      return;
    }

    const timer = setTimeout(async () => {
      setNicknameStatus("checking");
      try {
        const res = await fetch(
          `/api/auth/check-nickname?nickname=${encodeURIComponent(nick)}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.available) {
          setNicknameStatus("available");
          setNicknameChecked(true);
        } else {
          setNicknameStatus("taken");
          setNicknameChecked(false);
        }
      } catch {
        setNicknameStatus("idle");
        setNicknameChecked(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [form.nickname]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "phoneNumber") {
      setForm((prev) => ({ ...prev, phoneNumber: formatPhone(value) }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
    if (name === "nickname") {
      setNicknameChecked(false);
    }
  };

  const handleConsentChange = (key: keyof typeof consents) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAllConsent = () => {
    const allChecked = consents.terms && consents.privacy && consents.marketingEmail && consents.marketingSms;
    setConsents({
      terms: !allChecked,
      privacy: !allChecked,
      marketingEmail: !allChecked,
      marketingSms: !allChecked,
    });
  };

  // 다음 우편번호 검색 (체크아웃/마이페이지와 동일한 방식)
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
              if (data.buildingName !== "")
                extraAddress += extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName;
              fullAddress += extraAddress !== "" ? ` (${extraAddress})` : "";
            }
            setForm((f) => ({
              ...f,
              zipcode: data.zonecode,
              address: fullAddress,
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

  // 만 14세 이상 체크
  const isAgeValid = (birthDate: string) => {
    if (!birthDate) return false;
    const birth = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    const dayDiff = today.getDate() - birth.getDate();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    return actualAge >= 14;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nick = form.nickname.trim();
    const realName = form.realName.trim();
    const phone = form.phoneNumber.replace(/\D/g, "");

    if (!nick || nick.length < 2 || nick.length > 12) {
      setError("닉네임은 2~12자로 입력해주세요.");
      return;
    }
    if (!nicknameChecked) {
      setError("닉네임 중복 확인이 필요합니다. 잠시 기다려주세요.");
      return;
    }
    if (!realName) {
      setError("실명을 입력해주세요.");
      return;
    }
    const hasBirthInput = form.birthYear || form.birthMonth || form.birthDay;
    if (hasBirthInput && !(form.birthYear && form.birthMonth && form.birthDay)) {
      setError("생년월일은 년/월/일을 모두 선택해주세요. (선택 입력이므로 비워두셔도 됩니다)");
      return;
    }
    if (form.birthYear && form.birthMonth && form.birthDay) {
      const birthDateStr = `${form.birthYear}-${form.birthMonth.padStart(2, "0")}-${form.birthDay.padStart(2, "0")}`;
      if (!isAgeValid(birthDateStr)) {
        setError("만 14세 이상만 가입하실 수 있습니다.");
        return;
      }
    }
    if (!form.gender) {
      setError("성별을 선택해주세요.");
      return;
    }
    if (form.password.length < 6) {
      setError("비밀번호는 6자리 이상이어야 합니다.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (phone.length < 10 || phone.length > 11) {
      setError("올바른 휴대폰 번호를 입력해주세요.");
      return;
    }
    if (!form.zipcode || !form.address) {
      setError("배송을 위해 주소를 입력해주세요.");
      return;
    }
    if (!form.addressDetail.trim()) {
      setError("상세 주소를 입력해주세요.");
      return;
    }
    if (!consents.terms) {
      setError("이용약관에 동의해주세요.");
      return;
    }
    if (!consents.privacy) {
      setError("개인정보처리방침에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nick,
          realName,
          password: form.password,
          phoneNumber: phone,
          birthDate: form.birthYear && form.birthMonth && form.birthDay
            ? `${form.birthYear}-${form.birthMonth.padStart(2, "0")}-${form.birthDay.padStart(2, "0")}`
            : undefined,
          gender: form.gender,
          zipcode: form.zipcode,
          address: form.address,
          addressDetail: form.addressDetail.trim(),
          marketingEmail: consents.marketingEmail,
          marketingSms: consents.marketingSms,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }

      // 다른 앱 계정 통합 안내
      if (data.linkedApps && data.linkedApps.length > 0) {
        const appNames = data.linkedApps.join(", ");
        setLinkedAppsAlert(
          `이미 ${appNames} 앱에 가입된 계정이 존재하여 자동으로 통합되었습니다.\n앞으로 동일한 닉네임과 비밀번호로 두 앱을 모두 이용하실 수 있습니다.`
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nicknameStatusConfig = {
    available: { text: "사용 가능한 닉네임입니다.", color: "#22c55e" },
    taken: { text: "이미 사용 중인 닉네임입니다.", color: "#ef4444" },
    invalid: { text: "닉네임은 2~12자로 입력해주세요.", color: "#ef4444" },
    checking: { text: "확인 중...", color: "#9ca3af" },
    idle: { text: "", color: "" },
  };

  const allRequired = consents.terms && consents.privacy;
  const allConsented =
    consents.terms && consents.privacy && consents.marketingEmail && consents.marketingSms;

  if (linkedAppsAlert) {
    return (
      <main className="login-page">
        <div className="login-bg-blob login-bg-blob-1" />
        <div className="login-bg-blob login-bg-blob-2" />
        <div className="login-bg-blob login-bg-blob-3" />
        <div className="login-card">
          <div style={{ textAlign: "center", padding: "1rem 0 2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
            <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 700 }}>
              가입이 완료되었습니다!
            </h2>
            <div
              style={{
                background: "rgba(219,39,119,0.08)",
                border: "1px solid rgba(219,39,119,0.2)",
                borderRadius: "12px",
                padding: "1rem",
                marginBottom: "1.5rem",
                fontSize: "0.875rem",
                color: "var(--mb-gray-600)",
                lineHeight: 1.6,
                whiteSpace: "pre-line",
                textAlign: "left",
              }}
            >
              {linkedAppsAlert}
            </div>
            <button
              onClick={() => { router.push("/"); router.refresh(); }}
              className="login-btn"
            >
              시작하기 →
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card" style={{ maxWidth: "460px" }}>
        {/* 로고 */}
        <div className="login-logo-wrap">
          <div className="login-logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="16" fill="url(#mb-g1-signup)" />
              <path d="M9 22 L16 10 L23 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.5 18 H20.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="mb-g1-signup" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#e879a0" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-brand">모델뷰티</h1>
          <p className="login-tagline">회원가입</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          {/* ── 기본 정보 섹션 ── */}
          <div style={{
            fontSize: "0.75rem", fontWeight: 700, color: "var(--mb-gray-400)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: "0.75rem", marginTop: "0.25rem",
          }}>
            📋 기본 정보
          </div>

          {/* 닉네임 */}
          <div className="login-field">
            <label htmlFor="nickname">
              닉네임 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
              <span style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", marginLeft: "0.5rem", fontWeight: 400 }}>
                (2~12자, 모카·IMFF 앱과 공유)
              </span>
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              placeholder="예) 봄바람, 하늘이, mb123"
              value={form.nickname}
              onChange={handleChange}
              className="login-input"
              maxLength={12}
              autoFocus
            />
            {nicknameStatus !== "idle" && nicknameStatusConfig[nicknameStatus].text && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: nicknameStatusConfig[nicknameStatus].color,
                  marginTop: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                {nicknameStatus === "available" && "✅"}
                {nicknameStatus === "taken" && "❌"}
                {nicknameStatus === "invalid" && "⚠️"}
                {nicknameStatus === "checking" && "⏳"}
                {nicknameStatusConfig[nicknameStatus].text}
              </span>
            )}
          </div>

          {/* 실명 */}
          <div className="login-field">
            <label htmlFor="realName">
              실명 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
              <span style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", marginLeft: "0.5rem", fontWeight: 400 }}>
                (닉네임 찾기, 비밀번호 재설정 시 사용)
              </span>
            </label>
            <input
              id="realName"
              name="realName"
              type="text"
              placeholder="홍길동"
              value={form.realName}
              onChange={handleChange}
              className="login-input"
            />
          </div>

          {/* 생년월일 + 성별 (2열) */}
          {/* 생년월일 */}
          <div className="login-field">
            <label>
              생년월일 <span style={{ color: "var(--mb-gray-400)", fontSize: "0.75rem", fontWeight: 400 }}>(선택)</span>
            </label>
            {/* 생일 쿠폰 혜택 배너 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "linear-gradient(135deg, rgba(219,39,119,0.13), rgba(168,85,247,0.10))",
              border: "1px solid rgba(219,39,119,0.28)",
              borderRadius: "10px",
              padding: "0.55rem 0.875rem",
              marginBottom: "0.625rem",
              fontSize: "0.78rem",
              color: "#f9a8d4",
              fontWeight: 600,
              lineHeight: 1.4,
            }}>
              <span style={{ fontSize: "1.1rem" }}>🎂</span>
              <span>
                생일에 <strong style={{ color: "#fb7185" }}>모델뷰티 생일 쿠폰</strong>을 드려요!<br />
                <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "#f0abfc" }}>정확한 생년월일을 입력하시면 매년 생일날 특별 혜택이 발송됩니다 🎁</span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr", gap: "0.5rem" }}>
              <select
                id="birthYear"
                name="birthYear"
                value={form.birthYear}
                onChange={handleChange}
                className="login-input"
                style={{ cursor: "pointer" }}
              >
                <option value="">출생 연도</option>
                {Array.from({ length: new Date().getFullYear() - 14 - 1899 }, (_, i) => new Date().getFullYear() - 14 - i).map((y) => (
                  <option key={y} value={String(y)}>{y}년</option>
                ))}
              </select>
              <select
                id="birthMonth"
                name="birthMonth"
                value={form.birthMonth}
                onChange={handleChange}
                className="login-input"
                style={{ cursor: "pointer" }}
              >
                <option value="">월</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>{m}월</option>
                ))}
              </select>
              <select
                id="birthDay"
                name="birthDay"
                value={form.birthDay}
                onChange={handleChange}
                className="login-input"
                style={{ cursor: "pointer" }}
              >
                <option value="">일</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{d}일</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--mb-gray-400)", marginTop: "0.25rem", display: "block" }}>
              만 14세 이상 가입 가능
            </span>
          </div>

          {/* 성별 */}
          <div className="login-field">
            <label htmlFor="gender">
              성별 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="login-input"
              style={{ cursor: "pointer" }}
            >
              <option value="">선택하세요</option>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">선택 안함</option>
            </select>
          </div>

          {/* ── 보안 정보 섹션 ── */}
          <div style={{
            fontSize: "0.75rem", fontWeight: 700, color: "var(--mb-gray-400)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: "0.75rem", marginTop: "1.25rem",
          }}>
            🔒 보안 정보
          </div>

          {/* 비밀번호 */}
          <div className="login-field">
            <label htmlFor="password">
              비밀번호 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
            </label>
            <div className="login-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="6자 이상 입력"
                value={form.password}
                onChange={handleChange}
                className="login-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--mb-gray-400)",
                  fontSize: "0.875rem",
                  padding: "0.25rem",
                }}
              >
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div className="login-field">
            <label htmlFor="confirmPassword">
              비밀번호 확인 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
            </label>
            <div className="login-input-wrap">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호 재입력"
                value={form.confirmPassword}
                onChange={handleChange}
                className="login-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--mb-gray-400)",
                  fontSize: "0.875rem",
                  padding: "0.25rem",
                }}
              >
                {showConfirmPassword ? "숨기기" : "보기"}
              </button>
            </div>
            {form.confirmPassword && (
              <span
                style={{
                  fontSize: "0.75rem",
                  marginTop: "0.25rem",
                  display: "block",
                  color: form.password === form.confirmPassword ? "#22c55e" : "#ef4444",
                }}
              >
                {form.password === form.confirmPassword
                  ? "✅ 비밀번호가 일치합니다."
                  : "❌ 비밀번호가 일치하지 않습니다."}
              </span>
            )}
          </div>

          {/* ── 연락처 & 주소 섹션 ── */}
          <div style={{
            fontSize: "0.75rem", fontWeight: 700, color: "var(--mb-gray-400)",
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: "0.75rem", marginTop: "1.25rem",
          }}>
            📍 연락처 & 주소
          </div>

          {/* 휴대폰 번호 */}
          <div className="login-field">
            <label htmlFor="phoneNumber">
              휴대폰 번호 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
            </label>
            <div className="login-input-wrap">
              <span className="login-input-prefix">🇰🇷 +82</span>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={form.phoneNumber}
                onChange={handleChange}
                className="login-input login-input-phone"
                autoComplete="tel"
              />
            </div>
            <span style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", marginTop: "0.25rem", display: "block" }}>
              닉네임 찾기, 비밀번호 찾기 시 본인 확인에 사용됩니다.
            </span>
          </div>

          {/* 주소 */}
          <div className="login-field">
            <label>
              주소 <span style={{ color: "#db2777", fontSize: "0.75rem" }}>*</span>
              <span style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", marginLeft: "0.5rem", fontWeight: 400 }}>
                (배송을 위해 꼭 필요해요)
              </span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                readOnly
                placeholder="우편번호"
                value={form.zipcode}
                className="login-input"
                style={{ flex: "0 0 110px", cursor: "default", background: "var(--mb-gray-50, rgba(255,255,255,0.03))" }}
              />
              <button
                type="button"
                onClick={handleAddressSearch}
                style={{
                  flex: 1,
                  padding: "0.625rem 1rem",
                  background: "rgba(219,39,119,0.12)",
                  border: "1px solid rgba(219,39,119,0.35)",
                  borderRadius: "10px",
                  color: "#db2777",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(219,39,119,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(219,39,119,0.12)")}
              >
                🔍 주소 검색
              </button>
            </div>
            <input
              readOnly
              placeholder="기본 주소 (주소 검색 후 자동 입력)"
              value={form.address}
              className="login-input"
              style={{ marginBottom: "0.5rem", cursor: "default", background: "var(--mb-gray-50, rgba(255,255,255,0.03))" }}
            />
            <input
              id="addressDetail"
              name="addressDetail"
              type="text"
              placeholder="상세 주소 입력 (동, 호수 등)"
              value={form.addressDetail}
              onChange={handleChange}
              className="login-input"
            />
          </div>

          {/* ── 약관 동의 섹션 ── */}
          <div style={{
            marginTop: "1.5rem",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "1rem",
          }}>
            {/* 전체 동의 */}
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              cursor: "pointer",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              marginBottom: "0.75rem",
            }}>
              <input
                type="checkbox"
                checked={allConsented}
                onChange={handleAllConsent}
                id="consent-all"
                style={{ width: "18px", height: "18px", accentColor: "#db2777", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--mb-gray-200, #e2e8f0)" }}>
                전체 동의하기
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--mb-gray-400)", marginLeft: "auto" }}>
                선택 포함
              </span>
            </label>

            {/* 이용약관 */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", marginBottom: "0.625rem" }}>
              <input
                type="checkbox"
                checked={consents.terms}
                onChange={() => handleConsentChange("terms")}
                id="consent-terms"
                style={{ width: "16px", height: "16px", accentColor: "#db2777", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-300, #cbd5e1)", flex: 1 }}>
                <span style={{ color: "#db2777", fontWeight: 700, marginRight: "4px" }}>[필수]</span>
                이용약관 동의
              </span>
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", textDecoration: "underline", whiteSpace: "nowrap" }}
              >
                보기
              </a>
            </label>

            {/* 개인정보처리방침 */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", marginBottom: "0.625rem" }}>
              <input
                type="checkbox"
                checked={consents.privacy}
                onChange={() => handleConsentChange("privacy")}
                id="consent-privacy"
                style={{ width: "16px", height: "16px", accentColor: "#db2777", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-300, #cbd5e1)", flex: 1 }}>
                <span style={{ color: "#db2777", fontWeight: 700, marginRight: "4px" }}>[필수]</span>
                개인정보처리방침 동의
              </span>
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: "0.72rem", color: "var(--mb-gray-400)", textDecoration: "underline", whiteSpace: "nowrap" }}
              >
                보기
              </a>
            </label>

            {/* 마케팅 이메일 */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", marginBottom: "0.625rem" }}>
              <input
                type="checkbox"
                checked={consents.marketingEmail}
                onChange={() => handleConsentChange("marketingEmail")}
                id="consent-marketing-email"
                style={{ width: "16px", height: "16px", accentColor: "#db2777", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-400)", flex: 1 }}>
                <span style={{ color: "var(--mb-gray-400)", fontWeight: 700, marginRight: "4px" }}>[선택]</span>
                마케팅 이메일 수신 동의
              </span>
            </label>

            {/* 마케팅 SMS */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consents.marketingSms}
                onChange={() => handleConsentChange("marketingSms")}
                id="consent-marketing-sms"
                style={{ width: "16px", height: "16px", accentColor: "#db2777", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--mb-gray-400)", flex: 1 }}>
                <span style={{ color: "var(--mb-gray-400)", fontWeight: 700, marginRight: "4px" }}>[선택]</span>
                마케팅 SMS 수신 동의
              </span>
            </label>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-btn-primary"
            disabled={isSubmitting || !nicknameChecked || !allRequired}
            style={{ marginTop: "1.25rem" }}
          >
            {isSubmitting ? <span className="login-btn-spinner" /> : "가입하기"}
          </button>

          <div
            style={{
              textAlign: "center",
              fontSize: "0.875rem",
              borderTop: "1px solid var(--mb-gray-100)",
              paddingTop: "1rem",
              marginTop: "0.75rem",
              color: "var(--mb-gray-500)",
            }}
          >
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              style={{
                color: "var(--mb-pink-500)",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              로그인하기
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

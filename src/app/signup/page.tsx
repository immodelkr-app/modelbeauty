"use client";

// ============================================================
// 회원가입 페이지 — 닉네임/비밀번호 기반
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        return; // 알림 표시 후 사용자가 확인 클릭 시 이동
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

      <div className="login-card" style={{ maxWidth: "420px" }}>
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

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-btn-primary"
            disabled={isSubmitting || !nicknameChecked}
          >
            {isSubmitting ? <span className="login-btn-spinner" /> : "가입하기"}
          </button>

          <p className="login-notice">
            가입 시 <span>이용약관</span> 및 <span>개인정보처리방침</span>에 동의하게 됩니다.
          </p>

          <div
            style={{
              textAlign: "center",
              fontSize: "0.875rem",
              borderTop: "1px solid var(--mb-gray-100)",
              paddingTop: "1rem",
              marginTop: "0.5rem",
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

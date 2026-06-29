"use client";

// ============================================================
// 로그인 페이지 — 전화번호 OTP 인증 (2단계)
// Step 1: 전화번호 입력 → OTP 발송
// Step 2: OTP 입력 → 검증 → im-core-auth sync → 리다이렉트
// ============================================================

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";
import type { MasterUser } from "@/types";

type Step = "phone" | "otp" | "loading" | "nickname";

// useSearchParams를 사용하는 내부 컴포넌트 (Suspense 경계 필요)
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const { setMasterUser } = useAuthStore();
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // 닉네임 Step 3
  const [nickname, setNickname] = useState("");
  const [pendingUser, setPendingUser] = useState<{ id: string; phone: string; masterUserId?: string } | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP 재전송 카운트다운
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 전화번호 포맷팅 (010-XXXX-XXXX)
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  // 국제 전화번호 형식으로 변환 (+82XXXXXXXXXX)
  const toE164 = (formatted: string) => {
    const digits = formatted.replace(/\D/g, "");
    if (digits.startsWith("0")) {
      return `+82${digits.slice(1)}`;
    }
    return `+${digits}`;
  };

  // Step 1: OTP 발송
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      setError("올바른 전화번호를 입력해주세요.");
      setIsSubmitting(false);
      return;
    }

    try {
      const e164Phone = toE164(phone);
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: e164Phone,
      });

      if (sendError) {
        setError(sendError.message || "인증번호 발송에 실패했습니다.");
        return;
      }

      setStep("otp");
      setCountdown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: OTP 검증
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("6자리 인증번호를 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setStep("loading");

    try {
      const e164Phone = toE164(phone);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: otpCode,
        type: "sms",
      });

      if (verifyError || !data.user) {
        setStep("otp");
        setError("인증번호가 올바르지 않습니다. 다시 확인해주세요.");
        return;
      }

      // im-core-auth sync — 신규 유저 여부 판별
      const syncRes = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: data.user.phone,
          localUserId: data.user.id,
          name: data.user.user_metadata?.name,
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        const masterUser = syncData as MasterUser & { masterUserId?: string };

        // 신규 유저이거나 닉네임(name)이 없으면 → Step 3 닉네임 설정
        if (!masterUser.name || masterUser.name.trim() === "") {
          setPendingUser({
            id: data.user.id,
            phone: data.user.phone ?? "",
            masterUserId: masterUser.masterUserId,
          });
          setStep("nickname");
          return;
        }

        // 기존 유저 — 바로 로그인 완료
        setMasterUser(masterUser);
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setStep("otp");
      setError("인증 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: 닉네임 설정 후 완료
  const handleSetNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("닉네임은 2자 이상 입력해주세요.");
      return;
    }
    if (trimmed.length > 12) {
      setError("닉네임은 12자 이하로 입력해주세요.");
      return;
    }
    setIsSubmitting(true);
    setStep("loading");
    try {
      // im-core-auth에 닉네임 저장
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterUserId: pendingUser?.masterUserId,
          name: trimmed,
        }),
      });

      // 최신 유저 정보 로드
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setMasterUser(meData.user as MasterUser);
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setStep("nickname");
      setError("닉네임 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP 입력 칸 처리
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    otpRefs.current[nextEmpty]?.focus();
  };

  const handleResend = () => {
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setStep("phone");
  };

  // ── 이메일 로그인 ──────────────────────────────────────────
  const [loginMode, setLoginMode] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    setStep("loading");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !data.user) {
        setStep("phone");
        setError(signInError?.message || "이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      // 이메일 유저도 /api/auth/me로 마스터유저 정보 로드
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setMasterUser(meData.user as MasterUser);
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setStep("phone");
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 로딩 상태 */}
      {step === "loading" && (
        <div className="login-loading">
          <div className="login-spinner" />
          <p>로그인 처리 중...</p>
        </div>
      )}

      {/* Step 3: 닉네임 설정 (신규 회원 전용) */}
      {step === "nickname" && (
        <form onSubmit={handleSetNickname} className="login-form">
          <div className="login-form-header">
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
            <h2>환영합니다!</h2>
            <p>사용할 닉네임을 설정해 주세요.<br/>모카, IMFF 앱과 함께 사용됩니다.</p>
          </div>
          <div className="login-field">
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              type="text"
              placeholder="2~12자 닉네임 입력"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="login-input"
              autoFocus
              maxLength={12}
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--mb-gray-400)", marginTop: "0.25rem", display: "block" }}>
              {nickname.length}/12자 · 나중에 마이페이지에서 변경할 수 있어요
            </span>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-btn"
            disabled={isSubmitting || nickname.trim().length < 2}
          >
            {isSubmitting ? "저장 중..." : "가입 완료 →"}
          </button>
        </form>
      )}

      {/* 로그인 모드 탭 — phone/email 선택 (nickname step에서는 숨김) */}
      {step !== "loading" && step !== "otp" && step !== "nickname" && (
        <div style={{
          display: "flex",
          gap: "0",
          marginBottom: "1.5rem",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid rgba(219,39,119,0.2)",
        }}>
          <button
            type="button"
            onClick={() => { setLoginMode("phone"); setError(""); }}
            style={{
              flex: 1,
              padding: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: loginMode === "phone" ? "linear-gradient(135deg,#db2777,#9333ea)" : "transparent",
              color: loginMode === "phone" ? "#fff" : "#9ca3af",
              transition: "all 0.2s",
            }}
          >📱 휴대폰 인증</button>
          <button
            type="button"
            onClick={() => { setLoginMode("email"); setError(""); }}
            style={{
              flex: 1,
              padding: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: loginMode === "email" ? "linear-gradient(135deg,#db2777,#9333ea)" : "transparent",
              color: loginMode === "email" ? "#fff" : "#9ca3af",
              transition: "all 0.2s",
            }}
          >✉️ 이메일 로그인</button>
        </div>
      )}

      {/* 이메일 로그인 폼 */}
      {step !== "loading" && step !== "otp" && step !== "nickname" && loginMode === "email" && (
        <form onSubmit={handleEmailLogin} className="login-form">
          <div className="login-form-header">
            <h2>이메일로 로그인</h2>
            <p>이메일과 비밀번호를 입력하세요</p>
          </div>
          <div className="login-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              placeholder="admin@immodel.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="login-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      )}

      {/* Step 1: 전화번호 입력 */}
      {step === "phone" && loginMode === "phone" && (
        <form onSubmit={handleSendOtp} className="login-form">
          <div className="login-form-header">
            <h2>전화번호로 로그인</h2>
            <p>인증번호를 문자로 보내드립니다</p>
          </div>

          <div className="login-field">
            <label htmlFor="phone">전화번호</label>
            <div className="login-input-wrap">
              <span className="login-input-prefix">🇰🇷 +82</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="login-input login-input-phone"
                autoComplete="tel"
                autoFocus
                required
              />
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-btn-primary"
            disabled={isSubmitting || phone.replace(/\D/g, "").length < 10}
          >
            {isSubmitting ? (
              <span className="login-btn-spinner" />
            ) : (
              "인증번호 받기"
            )}
          </button>

          <p className="login-notice">
            로그인 시 <span>이용약관</span> 및 <span>개인정보처리방침</span>에 동의하게 됩니다
          </p>
        </form>
      )}

      {/* Step 2: OTP 입력 */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="login-form">
          <div className="login-form-header">
            <h2>인증번호 입력</h2>
            <p>
              <strong>{phone}</strong>으로 발송된
              <br />6자리 인증번호를 입력해주세요
            </p>
          </div>

          <div className="login-otp-wrap">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onPaste={i === 0 ? handleOtpPaste : undefined}
                className={`login-otp-input ${digit ? "login-otp-filled" : ""}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-btn-primary"
            disabled={isSubmitting || otp.join("").length !== 6}
          >
            {isSubmitting ? <span className="login-btn-spinner" /> : "확인"}
          </button>

          <div className="login-resend">
            {countdown > 0 ? (
              <p className="login-countdown">
                <span>{countdown}초</span> 후 재전송 가능
              </p>
            ) : (
              <button type="button" onClick={handleResend} className="login-resend-btn">
                인증번호 재전송
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}

// 로그인 페이지 — Suspense로 useSearchParams 감싸기
export default function LoginPage() {
  return (
    <main className="login-page">
      {/* 배경 장식 */}
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card">
        {/* 로고 영역 */}
        <div className="login-logo-wrap">
          <div className="login-logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="16" fill="url(#mb-g1)" />
              <path
                d="M9 22 L16 10 L23 22"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11.5 18 H20.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="mb-g1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#e879a0" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-brand">모델뷰티</h1>
          <p className="login-tagline">뷰티의 시작, 모델뷰티</p>
        </div>

        {/* useSearchParams는 Suspense 경계 필요 */}
        <Suspense
          fallback={
            <div className="login-loading">
              <div className="login-spinner" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

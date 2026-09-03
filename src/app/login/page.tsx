"use client";

// ============================================================
// 로그인 페이지 — 닉네임 + 비밀번호 기반
// - 닉네임 입력 → get-auth-email API로 가상 이메일 조회 → signInWithPassword
// - 닉네임 찾기 모달 (실명 + 전화번호 기반)
// - 비밀번호 재설정 모달 (닉네임 + 실명 + 전화번호 → 2단계 변경)
// ============================================================

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";
import type { MasterUser } from "@/types";
import Link from "next/link";
import { isAppWebView } from "@/lib/device/webview";
import { checkBiometricAvailability, loginWithBiometric, clearBiometricCredential } from "@/lib/device/biometricBridge";
import { markLoginAt } from "@/lib/session-timeout";

// ── 닉네임 찾기 모달 ──────────────────────────────────────────
function FindNicknameModal({ onClose }: { onClose: () => void }) {
  const [realName, setRealName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/find-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realName: realName.trim(),
          phoneNumber: phoneNumber.replace(/\D/g, ""),
        }),
      });
      const data = await res.json();
      if (data.found) {
        setResult(data.nickname);
      } else {
        setError("일치하는 회원 정보를 찾을 수 없습니다.");
      }
    } catch {
      setError("조회 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff",
        width: "100%", maxWidth: "400px",
        borderRadius: "20px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid #f1f5f9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px",
              background: "linear-gradient(135deg, #db2777, #9333ea)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem",
            }}>🔍</div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>닉네임 찾기</h3>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#94a3b8", padding: "0.25rem" }}>
            ✕
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {result ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.75rem" }}>
                회원님의 닉네임은
              </p>
              <div style={{
                background: "linear-gradient(135deg, #fdf2f8, #fae8ff)",
                border: "1.5px solid #f0abfc",
                borderRadius: "12px",
                padding: "1rem 1.5rem",
                marginBottom: "1.25rem",
              }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#9333ea" }}>{result}</span>
              </div>
              <button onClick={onClose} style={{
                width: "100%", padding: "0.75rem",
                background: "linear-gradient(135deg, #db2777, #9333ea)",
                color: "#fff", border: "none", borderRadius: "12px",
                fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer",
              }}>
                확인
              </button>
            </div>
          ) : (
            <form onSubmit={handleFind} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.6 }}>
                가입 시 등록한 <strong>실명</strong>과 <strong>휴대폰 번호</strong>로 닉네임을 확인합니다.
              </p>
              {error && (
                <div style={{
                  padding: "0.75rem", borderRadius: "10px",
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", fontSize: "0.8125rem", fontWeight: 600,
                }}>
                  {error}
                </div>
              )}
              <div className="login-field">
                <label>실명</label>
                <input type="text" className="login-input" placeholder="홍길동"
                  value={realName} onChange={(e) => setRealName(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>휴대폰 번호</label>
                <input type="tel" className="login-input" placeholder="010-0000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                  required />
              </div>
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "0.75rem",
                background: loading ? "#e2e8f0" : "linear-gradient(135deg, #db2777, #9333ea)",
                color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: "12px",
                fontSize: "0.9375rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
                {loading ? <><span className="login-btn-spinner" /> 조회 중...</> : "닉네임 찾기"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 비밀번호 재설정 모달 ───────────────────────────────────────
function ResetPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [uid, setUid] = useState("");
  const [masterUserId, setMasterUserId] = useState("");
  const [verifiedNickname, setVerifiedNickname] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [verifiedRealName, setVerifiedRealName] = useState("");

  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          realName: realName.trim(),
          phoneNumber: phoneNumber.replace(/\D/g, ""),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.found) {
        setError(data.error || "일치하는 회원 정보를 찾을 수 없습니다.");
        return;
      }
      setUid(data.uid ?? "");
      setMasterUserId(data.masterUserId ?? "");
      setVerifiedNickname(data.nickname || nickname.trim());
      setVerifiedPhone(data.phoneNumber || phoneNumber.replace(/\D/g, ""));
      setVerifiedRealName(data.realName || realName.trim());
      setStep(2);
    } catch {
      setError("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("비밀번호는 6자리 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // masterUserId 우선 전달 (크로스앱 지원), uid는 하위 호환용
          masterUserId: masterUserId || undefined,
          uid: uid || undefined,
          newPassword,
          phoneNumber: verifiedPhone,
          nickname: verifiedNickname,
          realName: verifiedRealName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "비밀번호 변경에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff", width: "100%", maxWidth: "400px",
        borderRadius: "20px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden",
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px",
              background: "linear-gradient(135deg, #db2777, #9333ea)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
            }}>🔑</div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>비밀번호 재설정</h3>
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>
                {step === 1 ? "1단계: 본인 확인" : "2단계: 새 비밀번호 설정"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", color: "#94a3b8" }}>
            ✕
          </button>
        </div>

        {/* 진행 바 */}
        <div style={{ height: "3px", background: "#f1f5f9" }}>
          <div style={{
            height: "100%", width: step === 1 ? "50%" : "100%",
            background: "linear-gradient(90deg, #db2777, #9333ea)",
            transition: "width 0.3s ease",
          }} />
        </div>

        <div style={{ padding: "1.5rem" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
              <p style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>
                비밀번호 변경 완료!
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.7, marginBottom: "1.5rem" }}>
                새 비밀번호로 로그인해 주세요.
              </p>
              <button onClick={onClose} style={{
                width: "100%", padding: "0.75rem",
                background: "linear-gradient(135deg, #db2777, #9333ea)",
                color: "#fff", border: "none", borderRadius: "12px",
                fontSize: "0.9375rem", fontWeight: 700, cursor: "pointer",
              }}>
                로그인하러 가기
              </button>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.6 }}>
                가입 시 등록한 정보를 입력해 본인 확인 후 비밀번호를 변경하세요.
              </p>
              {error && (
                <div style={{
                  padding: "0.75rem", borderRadius: "10px",
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", fontSize: "0.8125rem", fontWeight: 600,
                }}>
                  {error}
                </div>
              )}
              <div className="login-field">
                <label>닉네임</label>
                <input type="text" className="login-input" placeholder="가입 시 등록한 닉네임"
                  value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>실명</label>
                <input type="text" className="login-input" placeholder="홍길동"
                  value={realName} onChange={(e) => setRealName(e.target.value)} required />
              </div>
              <div className="login-field">
                <label>휴대폰 번호</label>
                <input type="tel" className="login-input" placeholder="010-0000-0000"
                  value={phoneNumber} onChange={(e) => setPhoneNumber(formatPhone(e.target.value))} required />
              </div>
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "0.75rem",
                background: loading ? "#e2e8f0" : "linear-gradient(135deg, #db2777, #9333ea)",
                color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: "12px",
                fontSize: "0.9375rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
                {loading ? <><span className="login-btn-spinner" /> 확인 중...</> : "본인 확인"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.6 }}>
                <strong style={{ color: "#9333ea" }}>{verifiedNickname}</strong>님, 본인 확인 완료!<br />
                새로 사용할 비밀번호를 입력해 주세요.
              </p>
              {error && (
                <div style={{
                  padding: "0.75rem", borderRadius: "10px",
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", fontSize: "0.8125rem", fontWeight: 600,
                }}>
                  {error}
                </div>
              )}
              <div className="login-field">
                <label>새 비밀번호 (6자리 이상)</label>
                <div className="login-input-wrap">
                  <input
                    type={showNewPw ? "text" : "password"} className="login-input"
                    placeholder="새 비밀번호 입력" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} minLength={6} required
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{
                    background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.8125rem",
                    padding: "0 1rem", whiteSpace: "nowrap", flexShrink: 0, height: "100%", display: "flex", alignItems: "center",
                  }}>
                    {showNewPw ? "숨기기" : "보기"}
                  </button>
                </div>
              </div>
              <div className="login-field">
                <label>새 비밀번호 확인</label>
                <div className="login-input-wrap">
                  <input
                    type={showConfirmPw ? "text" : "password"} className="login-input"
                    placeholder="비밀번호 재입력" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} required
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{
                    background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.8125rem",
                    padding: "0 1rem", whiteSpace: "nowrap", flexShrink: 0, height: "100%", display: "flex", alignItems: "center",
                  }}>
                    {showConfirmPw ? "숨기기" : "보기"}
                  </button>
                </div>
                {confirmPassword && (
                  <span style={{
                    fontSize: "0.75rem", marginTop: "0.25rem", display: "block",
                    color: newPassword === confirmPassword ? "#22c55e" : "#ef4444",
                  }}>
                    {newPassword === confirmPassword ? "✅ 일치합니다." : "❌ 일치하지 않습니다."}
                  </span>
                )}
              </div>
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "0.75rem",
                background: loading ? "#e2e8f0" : "linear-gradient(135deg, #db2777, #9333ea)",
                color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: "12px",
                fontSize: "0.9375rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              }}>
                {loading ? <><span className="login-btn-spinner" /> 변경 중...</> : "🔑 비밀번호 변경"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 로그인 폼 내부 컴포넌트 ───────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const mode = searchParams.get("mode");

  const { setMasterUser } = useAuthStore();
  const supabase = createSupabaseBrowserClient();

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFindNickname, setShowFindNickname] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // 관리자 이메일 로그인 (mode=admin)
  const [loginMode, setLoginMode] = useState<"nickname" | "email">("nickname");
  const [email, setEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // 지문 로그인 (앱 웹뷰 + 등록된 자격증명이 있을 때만)
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);

  useEffect(() => {
    if (mode === "admin") {
      setLoginMode("email");
    }
  }, [mode]);

  useEffect(() => {
    if (isAppWebView() && checkBiometricAvailability().credentialSaved) {
      setShowBiometricButton(true);
    }
  }, []);

  // 지문 로그인
  const handleBiometricLogin = async () => {
    setError("");
    setIsBiometricSubmitting(true);
    try {
      const result = await loginWithBiometric();
      if (!result.success || !result.token) {
        if (result.message === "invalidated") {
          clearBiometricCredential();
          setShowBiometricButton(false);
          setError("지문 정보가 변경되어 지문 로그인이 해제되었습니다. 다시 등록해주세요.");
        }
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession({ refresh_token: result.token });
      if (refreshError) {
        clearBiometricCredential();
        setShowBiometricButton(false);
        setError("로그인이 만료되었습니다. 닉네임과 비밀번호로 다시 로그인해주세요.");
        return;
      }

      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setMasterUser(meData.user as MasterUser);
      }

      markLoginAt();
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsBiometricSubmitting(false);
    }
  };

  // 닉네임 + 비밀번호 로그인
  const handleNicknameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // 닉네임 → 가상 이메일 조회
      const emailRes = await fetch("/api/auth/get-auth-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const emailData = await emailRes.json();

      if (emailData.notActivated) {
        setError("모카(MOCA)·IMFF에 가입된 닉네임이에요. 아래 '비밀번호 찾기'로 모델뷰티 비밀번호를 설정하면 바로 로그인할 수 있어요.");
        return;
      }

      if (!emailData.found || !emailData.authEmail) {
        setError("닉네임 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      // Supabase signInWithPassword
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailData.authEmail,
        password,
      });

      if (signInError || !data.user) {
        setError("닉네임 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      // 마스터 유저 정보는 signInWithPassword가 발생시키는 SIGNED_IN 이벤트를 받아
      // AuthProvider가 자동으로 채운다 (여기서 중복 호출하지 않음)
      markLoginAt();
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 관리자 이메일 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: adminPassword,
      });
      if (signInError || !data.user) {
        setError(signInError?.message || "이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      // 마스터 유저 정보는 signInWithPassword가 발생시키는 SIGNED_IN 이벤트를 받아
      // AuthProvider가 자동으로 채운다 (여기서 중복 호출하지 않음)
      const isAdminEmail = data.user.email?.startsWith("admin") || data.user.email === "admin@immodel.kr";
      markLoginAt();
      router.push(isAdminEmail && redirectTo === "/" ? "/admin" : redirectTo);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {showFindNickname && <FindNicknameModal onClose={() => setShowFindNickname(false)} />}
      {showResetPassword && <ResetPasswordModal onClose={() => setShowResetPassword(false)} />}

      {/* 로그인 모드 탭 (관리자용 이메일 전환) */}
      {mode === "admin" && (
        <div style={{
          display: "flex", gap: 0, marginBottom: "1.5rem",
          borderRadius: "12px", overflow: "hidden",
          border: "1px solid rgba(219,39,119,0.2)",
        }}>
          <button type="button"
            onClick={() => { setLoginMode("nickname"); setError(""); }}
            style={{
              flex: 1, padding: "0.75rem", fontSize: "0.875rem", fontWeight: 600,
              border: "none", cursor: "pointer",
              background: loginMode === "nickname" ? "linear-gradient(135deg,#db2777,#9333ea)" : "transparent",
              color: loginMode === "nickname" ? "#fff" : "#9ca3af", transition: "all 0.2s",
            }}
          >👤 닉네임 로그인</button>
          <button type="button"
            onClick={() => { setLoginMode("email"); setError(""); }}
            style={{
              flex: 1, padding: "0.75rem", fontSize: "0.875rem", fontWeight: 600,
              border: "none", cursor: "pointer",
              background: loginMode === "email" ? "linear-gradient(135deg,#db2777,#9333ea)" : "transparent",
              color: loginMode === "email" ? "#fff" : "#9ca3af", transition: "all 0.2s",
            }}
          >✉️ 관리자 이메일</button>
        </div>
      )}

      {/* 이메일 로그인 폼 (관리자) */}
      {loginMode === "email" ? (
        <form onSubmit={handleEmailLogin} className="login-form">
          <div className="login-form-header">
            <h2>관리자 로그인</h2>
            <p>관리자 이메일과 비밀번호를 입력하세요</p>
          </div>
          <div className="login-field">
            <label htmlFor="email">이메일</label>
            <input id="email" type="email" placeholder="admin@immodel.kr"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="login-input" autoFocus required />
          </div>
          <div className="login-field">
            <label htmlFor="admin-password">비밀번호</label>
            <input id="admin-password" type="password" placeholder="비밀번호 입력"
              value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              className="login-input" required />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={isSubmitting}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      ) : (
        /* 닉네임 + 비밀번호 로그인 폼 */
        <form onSubmit={handleNicknameLogin} className="login-form">
          <div className="login-form-header">
            <h2>로그인</h2>
            <p>닉네임과 비밀번호를 입력해주세요</p>
          </div>

          {showBiometricButton && (
            <>
              <button
                type="button"
                onClick={handleBiometricLogin}
                className="login-btn"
                disabled={isBiometricSubmitting}
                style={{ marginBottom: "1rem" }}
              >
                {isBiometricSubmitting ? "인증 중..." : "👆 지문으로 로그인"}
              </button>
              <div style={{
                textAlign: "center", fontSize: "0.75rem", color: "var(--mb-gray-400)",
                margin: "0 0 1rem",
              }}>
                또는
              </div>
            </>
          )}

          <div className="login-field">
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              type="text"
              placeholder="가입 시 등록한 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="login-input"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">비밀번호</label>
            <div className="login-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none", border: "none", cursor: "pointer", color: "var(--mb-gray-400)", fontSize: "0.8125rem",
                  padding: "0 1rem", whiteSpace: "nowrap", flexShrink: 0, height: "100%", display: "flex", alignItems: "center",
                }}
              >
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? <span className="login-btn-spinner" /> : "로그인"}
          </button>

          {/* 닉네임 찾기 / 비밀번호 재설정 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 0, marginTop: "0.5rem",
          }}>
            <button
              type="button"
              onClick={() => setShowFindNickname(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--mb-gray-500)", fontWeight: 600, fontSize: "0.8125rem",
                padding: "0.25rem 0.75rem 0.25rem 0",
                borderRight: "1px solid var(--mb-gray-200)",
              }}
            >
              닉네임 찾기
            </button>
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--mb-gray-500)", fontWeight: 600, fontSize: "0.8125rem",
                padding: "0.25rem 0 0.25rem 0.75rem",
              }}
            >
              비밀번호 찾기
            </button>
          </div>

          <div style={{
            textAlign: "center", fontSize: "0.875rem",
            borderTop: "1px solid var(--mb-gray-100)",
            paddingTop: "1rem", marginTop: "1rem",
            color: "var(--mb-gray-500)",
          }}>
            아직 회원이 아니신가요?{" "}
            <Link href="/signup" style={{
              color: "var(--mb-pink-500)", fontWeight: 700, textDecoration: "underline",
            }}>
              10초 회원가입
            </Link>
          </div>

          {/* 기존 OTP 가입자 안내 */}
          <div style={{
            background: "rgba(219,39,119,0.05)",
            border: "1px solid rgba(219,39,119,0.15)",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            fontSize: "0.75rem",
            color: "var(--mb-gray-500)",
            lineHeight: 1.6,
          }}>
            💡 <strong>기존 휴대폰 인증 가입자</strong>이신가요?<br />
            비밀번호 찾기를 통해 비밀번호를 설정하면<br />
            닉네임으로 간편하게 로그인할 수 있습니다.
          </div>
        </form>
      )}
    </>
  );
}

// ── 로그인 페이지 (Suspense 래퍼) ────────────────────────────
export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-bg-blob login-bg-blob-1" />
      <div className="login-bg-blob login-bg-blob-2" />
      <div className="login-bg-blob login-bg-blob-3" />

      <div className="login-card">
        {/* 로고 */}
        <div className="login-logo-wrap">
          <div className="login-logo-icon">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="16" fill="url(#mb-g1)" />
              <path d="M9 22 L16 10 L23 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.5 18 H20.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
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

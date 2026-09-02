"use client";

// ============================================================
// AuthProvider — 앱 전체 세션 초기화 및 상태 주입
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWishlistStore } from "@/store/wishlist.store";
import {
  getLoginAt,
  markLoginAt,
  clearLoginAt,
  isSessionExpired,
  markActivity,
  isIdleExpired,
} from "@/lib/session-timeout";
import { syncPushToken } from "@/lib/device/pushBridge";
import type { MasterUser } from "@/types";

// 세션 만료 여부를 확인할 주기 (라이브 방송 시청 등 조작 없는 상태에서도
// 로그인 후 3시간이 지나면 자동 로그아웃되도록 주기적으로 점검한다)
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

// 화면 조작(클릭/터치/키입력/스크롤) 감지 이벤트 — 유휴시간 계산용
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const { setMasterUser, setLoading, logout } = useAuthStore();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const resetCart = useCartStore((s) => s.reset);
  const fetchWishlist = useWishlistStore((s) => s.fetchWishlist);
  const resetWishlist = useWishlistStore((s) => s.reset);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // 로그인 성공 후 공통 초기화
    const onSignedIn = async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setMasterUser(data.user as MasterUser);
        // 장바구니 / 위시리스트 병렬 로드
        fetchCart();
        fetchWishlist();
        syncPushToken();
      } else {
        setMasterUser(null);
      }
    };

    // 로그아웃 후 공통 초기화
    const onSignedOut = () => {
      logout();
      resetCart();
      resetWishlist();
      clearLoginAt();
    };

    // 로그인 후 3시간 경과(절대 만료) 또는 1시간 30분 무조작(유휴 만료) 시 강제 로그아웃
    const enforceSessionTimeout = async (): Promise<boolean> => {
      if (!isSessionExpired() && !isIdleExpired()) return false;
      await supabase.auth.signOut();
      onSignedOut();
      router.push("/login");
      return true;
    };

    // 화면 조작 발생 시 마지막 활동 시각 갱신 (localStorage 쓰기 과다를 막기 위해 짧게 스로틀)
    let lastActivityWriteAt = 0;
    const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000;
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastActivityWriteAt = now;
      markActivity(now);
    };

    // 초기 세션 확인
    const initSession = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          // 기존 세션에 로그인 시각 기록이 없으면(배포 전 로그인 등) 지금부터 기산
          if (!getLoginAt()) markLoginAt();
          if (await enforceSessionTimeout()) return;
          markActivity();
          await onSignedIn();
        } else {
          setMasterUser(null);
          syncPushToken();
        }
      } catch {
        setMasterUser(null);
      }
    };

    initSession();

    // 세션 변경 이벤트 구독 (로그인/로그아웃 시 자동 반영)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        markLoginAt();
        markActivity();
        await onSignedIn();
      } else if (event === "SIGNED_OUT") {
        onSignedOut();
      }
    });

    // 주기적으로 세션 만료 여부 점검 (탭을 켜둔 채 방치해도 절대/유휴 만료 기준으로 로그아웃)
    const intervalId = window.setInterval(() => {
      enforceSessionTimeout();
    }, SESSION_CHECK_INTERVAL_MS);

    // 화면 복귀 시(백그라운드에서 돌아왔을 때) 즉시 점검
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        enforceSessionTimeout();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // 화면 조작 이벤트 구독 (유휴시간 계산)
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onUserActivity, { passive: true });
    });

    return () => {
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onUserActivity);
      });
    };
  }, [router, setMasterUser, setLoading, logout, fetchCart, resetCart, fetchWishlist, resetWishlist]);

  return <>{children}</>;
}

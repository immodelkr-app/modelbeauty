"use client";

// ============================================================
// AuthProvider — 앱 전체 세션 초기화 및 상태 주입
// ============================================================

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useWishlistStore } from "@/store/wishlist.store";
import type { MasterUser } from "@/types";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
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
      } else {
        setMasterUser(null);
      }
    };

    // 로그아웃 후 공통 초기화
    const onSignedOut = () => {
      logout();
      resetCart();
      resetWishlist();
    };

    // 초기 세션 확인
    const initSession = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await onSignedIn();
        } else {
          setMasterUser(null);
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
        await onSignedIn();
      } else if (event === "SIGNED_OUT") {
        onSignedOut();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setMasterUser, setLoading, logout, fetchCart, resetCart, fetchWishlist, resetWishlist]);

  return <>{children}</>;
}

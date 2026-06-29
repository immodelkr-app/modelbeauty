// ============================================================
// Zustand Auth Store — 모델뷰티 인증 상태 관리
// ============================================================

import { create } from "zustand";
import type { MasterUser } from "@/types";

interface AuthState {
  masterUser: MasterUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;

  setMasterUser: (user: MasterUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  masterUser: null,
  isLoading: true,
  isLoggedIn: false,

  setMasterUser: (user) =>
    set({
      masterUser: user,
      isLoggedIn: user !== null,
      isLoading: false,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  logout: () =>
    set({
      masterUser: null,
      isLoggedIn: false,
      isLoading: false,
    }),
}));

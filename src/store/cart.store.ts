// ============================================================
// Zustand Cart Store — 장바구니 상태 관리
// ============================================================

import { create } from "zustand";

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  stockQuantity: number;
  images: { url: string; alt: string; sortOrder: number }[];
  category: { id: string; name: string; slug: string } | null;
}

export interface CartVariant {
  id: string;
  optionValues: Record<string, string>;
  priceAdjustment: number;
  stockQuantity: number;
  sku: string | null;
}

export interface CartItem {
  id: string;
  masterUserId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  product: CartProduct | null;
  variant: CartVariant | null;
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  isLoading: boolean;
  isInitialized: boolean;

  // 서버 데이터 동기화
  fetchCart: () => Promise<void>;
  // 상품 추가
  addItem: (productId: string, variantId?: string, quantity?: number) => Promise<{ success: boolean; message: string }>;
  // 수량 변경
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  // 항목 삭제
  removeItem: (itemId: string) => Promise<void>;
  // 전체 비우기 (로컬)
  clearCart: () => void;
  // 로그아웃 시 초기화
  reset: () => void;
}

const initialState = {
  items: [],
  total: 0,
  itemCount: 0,
  isLoading: false,
  isInitialized: false,
};

export const useCartStore = create<CartState>((set, get) => ({
  ...initialState,

  fetchCart: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) {
        set({ isInitialized: true, isLoading: false });
        return;
      }
      const { data } = await res.json();
      set({
        items: data.items,
        total: data.total,
        itemCount: data.itemCount,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      set({ isInitialized: true, isLoading: false });
    }
  },

  addItem: async (productId, variantId, quantity = 1) => {
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, quantity }),
      });
      const result = await res.json();
      if (res.ok) {
        // 서버 최신 데이터로 동기화
        get().fetchCart();
        return { success: true, message: result.message };
      }
      return { success: false, message: result.error ?? "오류가 발생했습니다." };
    } catch {
      return { success: false, message: "네트워크 오류가 발생했습니다." };
    }
  },

  updateQuantity: async (itemId, quantity) => {
    // 낙관적 업데이트
    set((state) => {
      const items = state.items.map((item) =>
        item.id === itemId
          ? { ...item, quantity, subtotal: item.unitPrice * quantity }
          : item
      );
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      const itemCount = items.reduce((s, i) => s + i.quantity, 0);
      return { items, total, itemCount };
    });

    try {
      await fetch(`/api/cart/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
    } catch {
      // 실패 시 서버 데이터로 복원
      get().fetchCart();
    }
  },

  removeItem: async (itemId) => {
    // 낙관적 업데이트
    set((state) => {
      const items = state.items.filter((i) => i.id !== itemId);
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      const itemCount = items.reduce((s, i) => s + i.quantity, 0);
      return { items, total, itemCount };
    });

    try {
      await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
    } catch {
      get().fetchCart();
    }
  },

  clearCart: () => {
    set({ items: [], total: 0, itemCount: 0 });
    fetch("/api/cart/clear", { method: "DELETE" }).catch(() => {});
  },

  reset: () => set({ ...initialState }),
}));

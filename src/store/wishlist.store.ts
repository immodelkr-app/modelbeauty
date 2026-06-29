// ============================================================
// Zustand Wishlist Store — 위시리스트 상태 관리
// ============================================================

import { create } from "zustand";

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  salePrice: number | null;
  stockQuantity: number;
  images: { url: string; alt: string; sortOrder: number }[];
  isFeatured: boolean;
  category: { id: string; name: string; slug: string } | null;
}

export interface WishlistItem {
  id: string;
  masterUserId: string;
  createdAt: string;
  product: WishlistProduct | null;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  isInitialized: boolean;
  // productId 기준으로 위시리스트 여부 빠르게 조회
  wishedProductIds: Set<string>;

  fetchWishlist: () => Promise<void>;
  // 토글: 있으면 제거, 없으면 추가
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  reset: () => void;
}

const initialState = {
  items: [],
  isLoading: false,
  isInitialized: false,
  wishedProductIds: new Set<string>(),
};

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ...initialState,

  fetchWishlist: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await fetch("/api/wishlist");
      if (!res.ok) {
        set({ isInitialized: true, isLoading: false });
        return;
      }
      const { data } = await res.json();
      const wishedProductIds = new Set<string>(
        (data as WishlistItem[])
          .map((i) => i.product?.id)
          .filter(Boolean) as string[]
      );
      set({ items: data, wishedProductIds, isInitialized: true, isLoading: false });
    } catch {
      set({ isInitialized: true, isLoading: false });
    }
  },

  toggleWishlist: async (productId: string) => {
    const { items, wishedProductIds } = get();
    const isCurrentlyWished = wishedProductIds.has(productId);

    if (isCurrentlyWished) {
      // 제거: wishlist_item id 찾기
      const item = items.find((i) => i.product?.id === productId);
      if (!item) return;

      // 낙관적 업데이트
      const newSet = new Set(wishedProductIds);
      newSet.delete(productId);
      set({
        items: items.filter((i) => i.id !== item.id),
        wishedProductIds: newSet,
      });

      try {
        await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      } catch {
        get().fetchWishlist();
      }
    } else {
      // 추가: 낙관적 업데이트
      const newSet = new Set(wishedProductIds);
      newSet.add(productId);
      set({ wishedProductIds: newSet });

      try {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        if (res.ok) {
          // 서버에서 신규 항목 받아 갱신
          get().fetchWishlist();
        } else {
          // 실패 시 낙관적 업데이트 롤백
          const newSet2 = new Set(get().wishedProductIds);
          newSet2.delete(productId);
          set({ wishedProductIds: newSet2 });
        }
      } catch {
        const newSet2 = new Set(get().wishedProductIds);
        newSet2.delete(productId);
        set({ wishedProductIds: newSet2 });
      }
    }
  },

  isWishlisted: (productId: string) => get().wishedProductIds.has(productId),

  reset: () =>
    set({ ...initialState, wishedProductIds: new Set<string>() }),
}));

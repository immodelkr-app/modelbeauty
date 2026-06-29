// ============================================================
// 타입 정의 — 모델뷰티 앱
// ============================================================

// ── im-core-auth 공유 타입 ──────────────────────────────────

export type AppName = "MOCA" | "IMFF" | "MODEL_BEAUTY";

/** im-core-auth에서 sync 후 받는 마스터 유저 정보 */
export interface MasterUser {
  masterUserId: string;
  phoneNumber: string;
  name: string | null;
  integratedPoints: number;
  linkedApps: AppName[];
}

/** im-core-auth 포인트 잔액 응답 */
export interface PointBalance {
  masterUserId: string;
  integratedPoints: number;
}

/** im-core-auth 사용 가능 쿠폰 */
export interface AvailableCoupon {
  userCouponId: string;
  code: string;
  name: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  expiresAt: string | null;
}

// ── 상품 타입 ──────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  content: string | null;
  basePrice: number;
  salePrice: number | null;
  stockQuantity: number;
  sku: string | null;
  images: ProductImage[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  // 조인
  category?: Category;
  options?: ProductOption[];
  variants?: ProductVariant[];
}

export interface ProductImage {
  url: string;
  alt: string;
  sortOrder: number;
}

export interface ProductOption {
  id: string;
  productId: string;
  name: string;
  values: string[];
  sortOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  optionValues: Record<string, string>;
  sku: string | null;
  priceAdjustment: number;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
}

// ── 장바구니 타입 ──────────────────────────────────────────

export interface CartItem {
  id: string;
  masterUserId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  // 조인
  product?: Product;
  variant?: ProductVariant;
}

// ── 주문 타입 ──────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "shipping"
  | "delivered"
  | "confirmed"
  | "cancelled"
  | "refund_requested"
  | "refunded";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Order {
  id: string;
  orderNumber: string;
  masterUserId: string;
  subtotal: number;
  shippingFee: number;
  pointDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  paymentKey: string | null;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  recipientName: string;
  recipientPhone: string;
  addressZipcode: string;
  addressMain: string;
  addressDetail: string | null;
  deliveryMemo: string | null;
  usedPointAmount: number;
  usedCouponId: string | null;
  usedCouponCode: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  // 조인
  items?: OrderItem[];
  shippingInfo?: ShippingInfo;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantInfo: Record<string, string> | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  createdAt: string;
}

// ── 배송 타입 ──────────────────────────────────────────────

export interface ShippingInfo {
  id: string;
  orderId: string;
  carrierCode: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string | null;
  shippedAt: string;
  deliveredAt: string | null;
  lastTrackedAt: string | null;
  trackingStatus: TrackingStatus | null;
  createdAt: string;
}

export interface TrackingStatus {
  level: number;
  state: {
    id: string;
    text: string;
  };
  time: string;
  location: {
    name: string;
  };
  message: string;
}

// ── 환불 타입 ──────────────────────────────────────────────

export type RefundStatus = "pending" | "approved" | "rejected" | "completed";

export interface RefundRequest {
  id: string;
  orderId: string;
  masterUserId: string;
  reason: string;
  detailReason: string | null;
  refundAmount: number;
  pointRefundAmount: number;
  couponRefund: boolean;
  status: RefundStatus;
  adminNote: string | null;
  processedAt: string | null;
  processedBy: string | null;
  createdAt: string;
}

// ── API 응답 공통 타입 ────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

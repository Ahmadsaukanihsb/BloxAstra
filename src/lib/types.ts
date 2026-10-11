export type CategorySlug =
  | "gamepass"
  | "item"
  | "gift"
  | "akun"
  | "premium";

export type DeliveryKind = "gamepass_auto" | "manual" | "instant_code" | "credential";

export type OrderState =
  | "pending_payment"
  | "open_pool"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "disputed"
  | "refunded"
  | "cancelled";

export type SellerTier = 1 | 2 | 3;

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  fulfillment: string;
  slaMinutes: number;
  taxCoverSupported: boolean;
  autoDelivery: boolean;
  commissionPercent: number;
}

export interface Seller {
  id: string;
  storeName: string;
  handle: string;
  tier: SellerTier;
  isOnline: boolean;
  hasExpressBadge: boolean;
  /** average hand-over time, in seconds — drives the express badge */
  avgDeliverySeconds: number;
  rating: number;
  reviewCount: number;
  ordersCompleted: number;
  disputeRatePercent: number;
  joinedOn: string;
  city: string;
  kycVerified: boolean;
  bio: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  category: CategorySlug;
  game: string;
  /** net robux delivered, when the listing is a robux package */
  netRobux?: number;
  /**
   * How a robux listing is quoted: the buyer either targets a net amount and
   * the system grosses the gamepass up for them (cover), or sets the raw
   * gamepass price and eats Roblox's 30% cut (no_cover). Defaults to "cover".
   */
  pricingMode?: "cover" | "no_cover";
  price: number;
  compareAtPrice?: number;
  stock: number;
  deliveryKind: DeliveryKind;
  sellerId: string;
  sold: number;
  description: string;
  highlights: string[];
  /** hours the buyer has to confirm before the held balance auto-releases */
  autoReleaseHours: number;
  instantDelivery: boolean;
  /** flagged in the DB to appear on the home-page featured shelf */
  featured: boolean;
  /** seller-side pause switch — false hides the listing everywhere */
  isListed: boolean;
  /** seller-uploaded photo (data URL). Absent = generative art. */
  imageUrl?: string;
  /** manual curation order for featured / rail surfaces (lower sorts first) */
  sortOrder: number;
  /** landing-shelf placement: "pack" | "limited" | "service" | null */
  shelf: string | null;
}

export interface WalletEntry {
  id: string;
  type: "earning" | "withdrawal" | "penalty_debt" | "protection_bailout" | "refund";
  amount: number;
  balanceAfter: number;
  orderNumber?: string;
  note: string;
  createdAt: string;
}

export interface PoolOrder {
  id: string;
  orderNumber: string;
  productTitle: string;
  category: CategorySlug;
  total: number;
  robloxUsername: string;
  createdAt: string;
  /** seconds left before the pool order is re-broadcast to the next seller */
  claimWindowSeconds: number;
  expressBadge: boolean;
}

export interface OrderTimelineEntry {
  state: OrderState;
  label: string;
  at: string | null;
  note?: string;
  actor?: "system" | "buyer" | "seller" | "admin";
}

export interface MockOrder {
  id: string;
  orderNumber: string;
  state: OrderState;
  productSlug: string;
  sellerId: string;
  robloxUsername: string;
  robloxAvatarSeed: string;
  unitPrice: number;
  platformFee: number;
  total: number;
  isPoolOrder: boolean;
  expressBadge: boolean;
  createdAt: string;
  /** seconds left on the active SLA for this order (counted down on the client) */
  slaRemainingSeconds: number | null;
  /** what the running SLA clock means, shown next to the countdown */
  slaLabel: string | null;
  canCancelAfk: boolean;
  timeline: OrderTimelineEntry[];
  credentials: { username: string; passwordMasked: string; parentalPin: string } | null;
  handoverSteps: { id: string; label: string; hint: string; done: boolean }[];
  /** present only while the order sits in the admin dispute queue */
  dispute?: OrderDispute;
}

/** buyer complaint + seller defence, one per disputed order */
export interface OrderDispute {
  ref: string;
  reasonId: string;
  reasonLabel: string;
  buyerNote: string;
  sellerReply: string;
  evidence: string[];
  openedAt: string;
  /** until this moment the seller may still appeal with extra evidence */
  slaHoursLeft: number;
}

/** mirror of the admin_audit_logs table (product-requirements.md §6.1 table 20) */
export interface AdminAuditEntry {
  id: string;
  actionType: string;
  targetResource: "orders" | "wallets" | "credentials" | "users";
  targetResourceId: string;
  diffPayload: string;
  ipAddress: string;
  actor: string;
  createdAt: string;
}

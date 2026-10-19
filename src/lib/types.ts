export type CategorySlug =
  | "gamepass"
  | "item"
  | "gift"
  | "akun"
  | "premium";

export type DeliveryKind = "gamepass_auto" | "manual" | "instant_code" | "credential";

export type OrderState =
  | "pending_payment"
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
  /** shop logo (data URL or https image); null = monogram initials */
  storeImage?: string | null;
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
  /** ISO timestamp of the last row write — feeds sitemap `lastModified` */
  updatedAt: string;
}

/**
 * A couple of true numbers about the marketplace, for the home page's empty
 * states — the moment proof of a working shop matters most. Every field may be
 * 0: a marketplace with no history must show nothing rather than "0 order".
 */
export interface LandingSignals {
  completedOrders: number;
  verifiedSellers: number;
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

export interface OrderTimelineEntry {
  state: OrderState;
  label: string;
  at: string | null;
  note?: string;
  actor?: "system" | "buyer" | "seller" | "admin";
}

/** buyer complaint + seller defence, one per disputed order */
/** mirror of the admin_audit_logs table (product-requirements.md §6.1 table 20) */

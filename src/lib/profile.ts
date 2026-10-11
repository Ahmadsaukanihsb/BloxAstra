import "server-only";
import { db } from "@/lib/db";
import { getBuyerOrders } from "@/lib/orders";

export interface LinkedAccountView {
  provider: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

const PAID_ORDER_STATES = ["open_pool", "paid", "processing", "shipped", "completed", "disputed"];

export interface ProfileView {
  username: string;
  email: string;
  avatarImage: string | null;
  whatsapp: string | null;
  whatsappVerified: boolean;
  avatarUrl: string | null;
  role: "buyer" | "seller" | "admin";
  hasPassword: boolean;
  memberSince: string;
  linkedAccounts: LinkedAccountView[];
  activeOrders: number;
  completedOrders: number;
  paidTotal: number;
}

/** Everything /profil renders, in one round trip. */
export async function getProfileView(userId: string): Promise<ProfileView | null> {
  const [user, linked, orders] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        avatarImage: true,
        whatsapp: true,
        whatsappVerified: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    }),
    db.linkedAccount.findMany({
      where: { userId },
      select: { provider: true, email: true, avatarUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    getBuyerOrders(userId),
  ]);
  if (!user) return null;

  const avatarUrl =
    user.avatarImage ??
    linked.find((row) => row.provider === "google" && row.avatarUrl)?.avatarUrl ??
    linked.find((row) => row.avatarUrl)?.avatarUrl ??
    null;

  return {
    username: user.username,
    email: user.email,
    avatarImage: user.avatarImage,
    whatsapp: user.whatsapp,
    whatsappVerified: user.whatsappVerified,
    avatarUrl,
    role: user.role as ProfileView["role"],
    hasPassword: Boolean(user.passwordHash),
    memberSince: user.createdAt.toISOString(),
    linkedAccounts: linked.map((row) => ({
      provider: row.provider,
      email: row.email,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt.toISOString(),
    })),
    activeOrders: orders.activeCount,
    completedOrders: orders.orders.filter((o) => o.state === "completed").length,
    // Only money that actually left the buyer: excludes unpaid (pending_payment)
    // and reversed (cancelled/refunded) orders.
    paidTotal: orders.orders
      .filter((o) => PAID_ORDER_STATES.includes(o.state))
      .reduce((sum, o) => sum + o.total, 0),
  };
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  whatsapp: string | null;
  role: "buyer" | "seller" | "admin";
  /** True when the account has a custom photo — the nav then points <img> at /api/avatar. */
  hasAvatar: boolean;
  /** Row mtime as ms, used as `?v=` so a new upload busts the browser cache. */
  avatarVersion: number;
  /**
   * A buyer with no KYC review in flight — the only account state that may be
   * offered "Mulai jualan" in the nav. Keeps a rejected/pending account from
   * being pointed at a form it can no longer submit.
   */
  canApplyAsSeller: boolean;
}

/**
 * Resolve the signed-in user from the session cookie. Cached per request so
 * multiple components can call it without re-reading the cookie.
 *
 * Returns null when there is no valid session — callers decide whether to
 * redirect or render guest UI.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  const { userId } = session;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      whatsapp: true,
      role: true,
      avatarImage: true,
      updatedAt: true,
      kycStatus: true,
      suspendedAt: true,
      sessionVersion: true,
    },
  });
  if (!user) return null;
  // Suspended accounts lose their session everywhere immediately — the cookie
  // may still exist client-side, but every read treats it as signed out.
  if (user.suspendedAt) return null;
  // "Log out of all devices" / password change bumps the stored version, so
  // every cookie minted before that point stops authenticating here.
  if ((session.sessionVersion ?? 0) !== user.sessionVersion) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    whatsapp: user.whatsapp,
    role: user.role as CurrentUser["role"],
    hasAvatar: Boolean(user.avatarImage),
    avatarVersion: user.updatedAt.getTime(),
    canApplyAsSeller: user.role === "buyer" && user.kycStatus === "none",
  };
});

/** Like getCurrentUser but redirects to /masuk when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  return user;
}

/** Require a specific role. Role mismatch goes home (never back to /masuk — the user IS signed in). */
export async function requireRole(role: CurrentUser["role"]): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(user.role === "admin" ? "/admin" : "/");
  return user;
}

/** Require the user to be signed in and own the order, be its seller, or (for pool
 * orders) be any seller who can claim it. Admins are always allowed. */
export async function requireOrderParticipant(orderId: string): Promise<{
  user: CurrentUser;
  order: { id: string; code: string; buyerId: string; sellerId: string | null; status: string };
}> {
  const user = await requireUser();
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, buyerId: true, sellerId: true, status: true },
  });
  if (!order) redirect("/pesanan");

  const isBuyer = order.buyerId === user.id;
  let isSeller = false;
  if (order.sellerId) {
    const profile = await db.sellerProfile.findUnique({
      where: { id: order.sellerId },
      select: { userId: true },
    });
    isSeller = profile?.userId === user.id;
  } else if (user.role === "seller") {
    // Pool orders can be viewed by any seller so they can claim them.
    isSeller = true;
  }
  if (!isBuyer && !isSeller && user.role !== "admin") redirect("/pesanan");

  return { user, order };
}

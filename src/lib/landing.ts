import "server-only";

import { db } from "@/lib/db";
import type { LandingSignals } from "@/lib/types";

/**
 * The two numbers the home page is allowed to quote when its shelves are empty.
 *
 * The home page is built out of the live catalog, so on a day with nothing
 * listed most of it has nothing to show. What still sells in that moment is
 * proof that the shop is real and already working — but only counts that are
 * actually above zero, because a brand-new marketplace printing "0 order
 * selesai" is worse than printing nothing. The caller decides that; this only
 * reports what is true.
 *
 * Deliberately uncached: two COUNTs are cheap, and a stale proof bar (claiming
 * six verified sellers on a day with four) would be a lie in the one place the
 * page is trying to earn trust.
 */
export async function getLandingSignals(): Promise<LandingSignals> {
  const [completedOrders, verifiedSellers] = await Promise.all([
    db.order.count({ where: { status: "completed" } }),
    db.sellerProfile.count({ where: { kycVerified: true } }),
  ]);
  return { completedOrders, verifiedSellers };
}

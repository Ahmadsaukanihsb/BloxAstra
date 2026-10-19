import type { LandingSignals } from "@/lib/types";
import { formatNumber } from "@/lib/format";

/**
 * Which proof numbers are worth printing, and how they read.
 *
 * Kept apart from the query in `lib/landing.ts` (which is server-only) because
 * this rule is a product decision, not a database read: a brand-new marketplace
 * has no history, and "0 order selesai · 0 penjual terverifikasi" is a worse
 * first impression than saying nothing at all. So a count only earns a line when
 * it is actually above zero.
 */
export function landingSignalLabels(signals: LandingSignals): string[] {
  const labels: string[] = [];
  if (signals.completedOrders > 0) {
    labels.push(`${formatNumber(signals.completedOrders)} order selesai`);
  }
  if (signals.verifiedSellers > 0) {
    labels.push(`${formatNumber(signals.verifiedSellers)} penjual terverifikasi KYC`);
  }
  return labels;
}

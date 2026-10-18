import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

/**
 * The old super dashboard has been folded into /admin (KYC lives in its
 * own tab there now). This route stays as a redirect so bookmarked and
 * notified links keep working.
 */
export default async function SuperDashboardRedirect() {
  await requireRole("admin");
  redirect("/admin?tab=kyc");
}

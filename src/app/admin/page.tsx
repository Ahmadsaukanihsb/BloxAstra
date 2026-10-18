import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  getAdminDashboard,
  getAdminProducts,
  getAdminPromos,
  getAdminReviews,
  getAdminTopUps,
  getAdminUsers,
  getChatReports,
  getKycQueue,
} from "@/lib/admin";
import { getLandingLayout } from "@/lib/landing-sections";
import { getActiveRates } from "@/lib/rate-card";
import { getPaymentFees } from "@/lib/payments";
import { getBanks, getWithdrawalConfig } from "@/lib/wallet";
import { getSweepTimeouts } from "@/lib/sweep";
import { getSiteLogo } from "@/lib/site-logo";
import { getSiteFavicon } from "@/lib/site-favicon";
import { getSitePopup, getSitePromo } from "@/lib/site-notice";
import { getSocialLinks } from "@/lib/social-links";
import { getServiceArt } from "@/lib/service-art";
import { getBlogPostsForAdmin } from "@/lib/blog";
import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Panel admin",
  description:
    "Panel operasional Blox Astra: arbitrase sengketa, escrow & manual payout, serta log audit admin.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-20 pt-8 md:pt-10">
          <Skeleton className="h-9 w-48" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-well" />
            ))}
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  await connection();
  const user = await requireRole("admin");
  const [dashboard, rates, serviceArt, products, promos, topUps, reports, fees, withdrawal, banks, timeouts, logo, favicon, promo, popup, social, landing, blogPosts, kyc, users, reviews] =
    await Promise.all([
      getAdminDashboard(),
      getActiveRates(),
      getServiceArt(),
      getAdminProducts(),
      getAdminPromos(),
      getAdminTopUps(),
      getChatReports(),
      getPaymentFees(),
      getWithdrawalConfig(),
      getBanks(),
      getSweepTimeouts(),
      getSiteLogo(),
      getSiteFavicon(),
      getSitePromo(),
      getSitePopup(),
      getSocialLinks(),
      getLandingLayout(),
      getBlogPostsForAdmin(),
      getKycQueue(),
      getAdminUsers(),
      getAdminReviews(),
    ]);
  dashboard.adminName = user.username;
  dashboard.adminEmail = user.email;

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <AdminShell
        initialDisputes={dashboard.openDisputes}
        initialEscrow={dashboard.escrowOrders}
        initialWithdrawals={dashboard.pendingWithdrawals}
        initialAuditLogs={dashboard.auditLogs}
        initialRates={rates}
        initialServiceArt={serviceArt}
        initialProducts={products}
        initialPromos={promos}
        initialSettings={{
          fees: { qris: fees.qris, va: fees.va, ewallet: fees.ewallet },
          withdrawal,
          banks,
          timeouts,
        }}
        initialTopUps={topUps.rows}
        initialReports={reports}
        initialLogo={logo}
        initialFavicon={favicon}
        initialPromo={promo}
        initialPopup={popup}
        initialSocial={social}
        initialLanding={landing}
        initialBlogPosts={blogPosts}
        initialKyc={kyc}
        initialUsers={users.rows}
        suspendedCount={users.suspendedCount}
        initialReviews={reviews}
        adminName={dashboard.adminName}
        adminEmail={dashboard.adminEmail}
        totals={{
          heldTotal: dashboard.heldTotal,
          escrowCount: dashboard.escrowCount,
          openDisputeCount: dashboard.openDisputeCount,
          pendingWithdrawalCount: dashboard.pendingWithdrawalCount,
          auditTotal: dashboard.auditTotal,
        }}
      />
    </div>
  );
}

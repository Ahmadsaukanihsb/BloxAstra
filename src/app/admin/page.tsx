import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/admin";
import { getActiveRates } from "@/lib/rate-card";
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
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
          <Skeleton className="h-9 w-48" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
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
  const [dashboard, rates] = await Promise.all([getAdminDashboard(), getActiveRates()]);
  dashboard.adminName = user.username;
  dashboard.adminEmail = user.email;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
      <AdminShell
        initialDisputes={dashboard.openDisputes}
        initialEscrow={dashboard.escrowOrders}
        initialWithdrawals={dashboard.pendingWithdrawals}
        initialAuditLogs={dashboard.auditLogs}
        initialRates={rates}
        adminName={dashboard.adminName}
        adminEmail={dashboard.adminEmail}
        totals={{
          heldTotal: dashboard.heldTotal,
          escrowCount: dashboard.escrowCount,
          openDisputeCount: dashboard.openDisputeCount,
          pendingWithdrawalCount: dashboard.pendingWithdrawalCount,
        }}
      />
    </div>
  );
}

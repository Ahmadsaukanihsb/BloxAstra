import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

/** App chrome for every dashboard route: left rail on desktop, sticky pill bar
 *  on mobile. The site top nav is already hidden here by NavGate. */
export function DashboardShell({
  user,
  children,
}: {
  user: { username: string; role: "buyer" | "seller" | "admin" };
  children: ReactNode;
}) {
  return (
    <>
      <DashboardSidebar username={user.username} role={user.role} />
      <div className="lg:pl-64">{children}</div>
    </>
  );
}

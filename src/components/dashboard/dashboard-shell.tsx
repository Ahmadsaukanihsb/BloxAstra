import type { ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

/** App chrome for every dashboard route: left rail on desktop, sticky pill bar
 *  on mobile. The site top nav is already hidden here by NavGate. */
export function DashboardShell({
  user,
  groupUnread = 0,
  logo,
  children,
}: {
  user: { username: string; role: "buyer" | "seller" | "admin" };
  /** Unread seller-group messages, shown next to "Grup seller" in the rail. */
  groupUnread?: number;
  /** Custom logo data URL (null = built-in mark), read server-side in layout. */
  logo?: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <DashboardSidebar username={user.username} role={user.role} groupUnread={groupUnread} logo={logo ?? null} />
      <div className="lg:pl-64">{children}</div>
    </>
  );
}

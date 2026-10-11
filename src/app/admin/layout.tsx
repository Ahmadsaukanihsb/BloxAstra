import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const user = await requireRole("admin");
  return (
    <DashboardShell user={{ username: user.username, role: user.role }}>
      {children}
    </DashboardShell>
  );
}

import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await connection();
  const user = await requireUser();
  return (
    <DashboardShell user={{ username: user.username, role: user.role }}>
      {children}
    </DashboardShell>
  );
}

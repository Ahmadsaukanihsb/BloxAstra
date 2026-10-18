import { connection } from "next/server";
import { requireRole } from "@/lib/auth";

/**
 * The console stands on its own.
 *
 * Wrapping it in DashboardShell used to put two navigation columns side by
 * side — the site rail plus the console's own tab desk — and ate half the
 * screen before any work was visible. The site-side doors the rail provided
 * (Beranda, Preview penjual, Keluar) now live at the bottom of the console's
 * own nav, in the "Situs" group.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  await requireRole("admin");
  return children;
}

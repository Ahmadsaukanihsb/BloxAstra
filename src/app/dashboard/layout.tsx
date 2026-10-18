import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerChatUnreadCount } from "@/lib/seller";
import { getSiteLogo } from "@/lib/site-logo";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await connection();
  const user = await requireUser();
  // Read here rather than in the client rail so the badge is already correct in
  // the streamed shell; the room's live channel keeps it current from there.
  const [groupUnread, logo] = await Promise.all([
    user.role === "seller" ? getSellerChatUnreadCount(user.id) : Promise.resolve(0),
    getSiteLogo(),
  ]);
  return (
    <DashboardShell
      user={{ username: user.username, role: user.role }}
      groupUnread={groupUnread}
      logo={logo}
    >
      {children}
    </DashboardShell>
  );
}

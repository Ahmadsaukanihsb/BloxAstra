import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { RobuxGlyph } from "@/components/ui/icons";
import { UserDropdown } from "./user-dropdown";

/**
 * Server-rendered auth slot for the top nav. Reads the session cookie on the
 * server and renders either a "Masuk" CTA or a signed-in user dropdown. Passed as
 * a prop into the client TopNav so the nav itself stays a client component.
 */
export async function NavAuth() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/masuk"
        className="hidden h-9 items-center gap-1.5 rounded-full bg-astra px-4 text-[13px] font-extrabold text-white transition-[transform,translate,scale,rotate,background-color] duration-300 ease-[var(--ease-astra)] hover:bg-astra-bright active:scale-[0.97] md:flex"
      >
        <RobuxGlyph size={15} />
        Masuk
      </Link>
    );
  }

  return (
    <UserDropdown
      username={user.username}
      role={user.role}
      hasAvatar={user.hasAvatar}
      avatarVersion={user.avatarVersion}
      canApplyAsSeller={user.canApplyAsSeller}
    />
  );
}

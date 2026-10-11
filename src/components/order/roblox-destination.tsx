"use client";

import { useEffect, useState } from "react";
import { verifyRobloxUsername } from "@/app/actions/roblox";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Delivery destination with the Roblox headshot. Lazy + fail-soft: while
 * loading (or when Roblox is unreachable / the identifier is an email) it
 * degrades to the plain username text.
 */
export function RobloxDestination({ username }: { username: string }) {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!USERNAME_RE.test(username.trim())) return;
    let alive = true;
    void (async () => {
      const result = await verifyRobloxUsername(username.trim());
      if (alive && result.ok && result.found && result.avatarUrl) {
        setAvatar(result.avatarUrl);
      }
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  if (!avatar) {
    return (
      <span className="num text-[13px] text-ink">
        tujuan @{username}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      {/* Roblox CDN headshot — plain img, hidden if it fails to load. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatar}
        alt={`Avatar ${username}`}
        width={36}
        height={36}
        className="size-9 rounded-full bg-canvas object-cover outline outline-1 -outline-offset-1 outline-line"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">tujuan</span>
        <span className="num truncate text-[13px] font-bold text-ink">@{username}</span>
      </span>
    </span>
  );
}

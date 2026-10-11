"use server";

import { fetchRobloxAvatarUrl, lookupRobloxUsers } from "@/lib/roblox";

export type RobloxCheckResult =
  | {
      ok: true;
      found: boolean;
      canonicalName: string | null;
      displayName: string | null;
      avatarUrl: string | null;
    }
  | { ok: false; error: string };

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Prove a Roblox username exists via the live Roblox API. The buyer still has
 * to tick the "this profile is mine" box, but the name can no longer be
 * fictional on the checkout page.
 *
 * Roblox outages surface as `ok:false` — the buyer can retry, and the copy
 * never claims a manual-upload fallback that does not exist.
 */
export async function verifyRobloxUsername(rawInput: unknown): Promise<RobloxCheckResult> {
  if (typeof rawInput !== "string") {
    return { ok: false, error: "Username kosong." };
  }
  const username = rawInput.trim();
  if (username.length === 0) {
    return { ok: false, error: "Username kosong." };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "3–20 karakter: huruf, angka, underscore." };
  }

  try {
    const [found] = await lookupRobloxUsers([username]);
    if (!found) {
      return { ok: true, found: false, canonicalName: null, displayName: null, avatarUrl: null };
    }
    const avatarUrl = await fetchRobloxAvatarUrl(found.id);
    return {
      ok: true,
      found: true,
      canonicalName: found.name,
      displayName: found.displayName,
      avatarUrl,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal menghubungi Roblox. Coba lagi.",
    };
  }
}

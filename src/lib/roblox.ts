import "server-only";

/**
 * Roblox public API client. Used to prove a username exists before a buyer
 * hands over an order destination — the checkout UI no longer just checks the
 * shape of the string locally.
 *
 * Docs: https://roblox.fandom.com/wiki/Users_API  (public, unauthenticated
 * POST https://users.roblox.com/v1/usernames/users with a JSON body)
 */

export interface RobloxUserLookup {
  /** canonical Roblox id */
  id: number;
  /** exact Roblox username (case may differ from the input) */
  name: string;
  displayName: string;
}

export class RobloxApiError extends Error {}

const ENDPOINT = "https://users.roblox.com/v1/usernames/users";
const TIMEOUT_MS = 8_000;

/** Resolve usernames → Roblox accounts. Unknown names are simply absent. */
export async function lookupRobloxUsers(
  usernames: string[],
  timeoutMs: number = TIMEOUT_MS,
): Promise<RobloxUserLookup[]> {
  const names = [...new Set(usernames.map((item) => item.trim()).filter(Boolean))];
  if (names.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, 15000)));
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ usernames: names.slice(0, 100), excludeBannedUsers: false }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 429) {
      throw new RobloxApiError("Rate limit Roblox tercapai. Coba lagi sebentar.");
    }
    if (!response.ok) {
      throw new RobloxApiError(`Roblox ${response.status}`);
    }
    const data = (await response.json()) as {
      data?: Array<{ id: number; name: string; displayName?: string }>;
    };
    if (!Array.isArray(data.data)) {
      throw new RobloxApiError("Respons Roblox tidak terbaca.");
    }
    return data.data.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName ?? row.name,
    }));
  } catch (error) {
    if (error instanceof RobloxApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RobloxApiError("Roblox lambat menjawab.");
    }
    throw new RobloxApiError("Tidak bisa menghubungi Roblox.");
  } finally {
    clearTimeout(timer);
  }
}

/** True when the username exists on Roblox. */
export async function robloxUserExists(username: string): Promise<boolean> {
  const [found] = await lookupRobloxUsers([username]);
  return Boolean(found);
}

const AVATAR_ENDPOINT = "https://thumbnails.roblox.com/v1/users/avatar-headshot";

/**
 * Headshot thumbnail for a Roblox user id. Fail-soft — a missing/slow
 * thumbnail must never block verification, so null means "no picture".
 */
export async function fetchRobloxAvatarUrl(userId: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${AVATAR_ENDPOINT}?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      data?: Array<{ targetId: number; state: string; imageUrl: string }>;
    };
    const row = data.data?.[0];
    if (!row || row.state !== "Completed" || typeof row.imageUrl !== "string") return null;
    return row.imageUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

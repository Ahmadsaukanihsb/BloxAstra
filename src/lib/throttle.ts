/**
 * Tiny in-memory action throttle (same pattern as the login lock).
 * Single-instance safe — matches this app's deployment model.
 * Keyed per caller so one user's burst never punishes another's.
 *
 * Entries are pruned occasionally: a per-key map that only ever grows would
 * leak one row per distinct caller for the life of the process.
 */

const hits = new Map<string, number>();

/** Entries older than this are dead weight for every window in the app. */
const MAX_AGE_MS = 60 * 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  // Cheap check first; the full scan runs at most once a minute.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, at] of hits) {
    if (now - at > MAX_AGE_MS) hits.delete(key);
  }
}

/**
 * Returns true when the caller may proceed (and records the hit).
 * Returns false when the same key fired within `windowMs`.
 */
export function checkThrottle(key: string, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const last = hits.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  hits.set(key, now);
  return true;
}

/** Forget a key (testing / manual reset). */
export function clearThrottle(key: string): void {
  hits.delete(key);
}

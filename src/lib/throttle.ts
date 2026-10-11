/**
 * Tiny in-memory action throttle (same pattern as the login lock).
 * Single-instance safe — matches this app's deployment model.
 * Keyed per caller so one user's burst never punishes another's.
 */

const hits = new Map<string, number>();

/**
 * Returns true when the caller may proceed (and records the hit).
 * Returns false when the same key fired within `windowMs`.
 */
export function checkThrottle(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = hits.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  hits.set(key, now);
  return true;
}

/** Forget a key (testing / manual reset). */
export function clearThrottle(key: string): void {
  hits.delete(key);
}

import "server-only";
import { publishLive } from "@/lib/live-bus";

/**
 * Who is around right now, for the seller room.
 *
 * Presence is inferred from the realtime channel that is already open: every
 * seller with a dashboard page has an `/api/live` stream (the unread badge opens
 * one), so a live stream *is* the signal — no new client, no new endpoint, no
 * websocket process. The registry is deliberately in memory: it describes open
 * sockets, and sockets live in exactly one process. A multi-instance
 * deployment would need Redis here, the same caveat the live bus carries.
 *
 * Entries age out: the SSE route touches its entry on every heartbeat (20s), so
 * an entry unheard from for longer than the window below is gone even if its
 * close event never arrived through a proxy.
 */
export interface OnlineSeller {
  userId: string;
  name: string;
}

interface PresenceEntry {
  name: string;
  /** How many open streams this seller has — a second tab must not evict the first. */
  connections: number;
  lastSeen: number;
}

const PRESENCE_KEY = Symbol.for("bloxastra.chat-presence");

/** Two heartbeats plus slack: long enough that a laggy stream is not "offline". */
const STALE_MS = 45_000;

function registry(): Map<string, PresenceEntry> {
  const scope = globalThis as unknown as { [key: symbol]: unknown };
  const existing = scope[PRESENCE_KEY] as Map<string, PresenceEntry> | undefined;
  if (existing) return existing;
  const created = new Map<string, PresenceEntry>();
  scope[PRESENCE_KEY] = created;
  return created;
}

/** One open stream for this seller. Also tells every open room to look again. */
export function joinPresence(userId: string, name: string): void {
  const entries = registry();
  const entry = entries.get(userId);
  entries.set(userId, {
    name,
    connections: (entry?.connections ?? 0) + 1,
    lastSeen: Date.now(),
  });
  publishLive("presence", "sellers");
}

/** A stream closed. The last one out removes the seller from the list. */
export function leavePresence(userId: string): void {
  const entries = registry();
  const entry = entries.get(userId);
  if (!entry) return;
  if (entry.connections > 1) {
    entry.connections -= 1;
    entry.lastSeen = Date.now();
  } else {
    entries.delete(userId);
  }
  publishLive("presence", "sellers");
}

/** Heartbeat from the open stream — a dead entry expires without this. */
export function touchPresence(userId: string): void {
  const entry = registry().get(userId);
  if (entry) entry.lastSeen = Date.now();
}

/**
 * Sellers with a live stream right now, alphabetical. `excludeUserId` keeps the
 * viewer out of their own list — a room that announces you to yourself is just
 * noise.
 */
export function listOnlineSellers(excludeUserId?: string): OnlineSeller[] {
  const cutoff = Date.now() - STALE_MS;
  const online: OnlineSeller[] = [];
  for (const [userId, entry] of registry()) {
    if (entry.lastSeen < cutoff) {
      registry().delete(userId);
      continue;
    }
    if (userId === excludeUserId) continue;
    online.push({ userId, name: entry.name });
  }
  return online.sort((a, b) => a.name.localeCompare(b.name, "id"));
}

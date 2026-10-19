import "server-only";

export type LiveTopic = "inbox" | "chat" | "presence" | "room" | "pool";

export interface LiveEvent {
  topic: LiveTopic;
  /**
   * Who may see it: `user:<id>` for anything aimed at one account (their
   * inbox, their order rooms), `sellers` for the shared room (chat messages
   * and who is currently online in it).
   */
  audience: string;
  seq: number;
  at: number;
}

type Listener = (event: LiveEvent) => void;

interface LiveBus {
  listeners: Set<Listener>;
  seq: number;
}

/**
 * Next builds each entry point (a route handler, a server action) as its own
 * module instance, so a module-level Set would be a *different* Set inside the
 * SSE route than inside the action that publishes. Hanging the bus on
 * globalThis keeps one bus per process, which is what a single-process
 * deployment (pm2 fork) needs. A multi-instance setup would need real pub/sub
 * (e.g. Redis) — the polling fallback covers that gap today.
 */
const BUS_KEY = Symbol.for("bloxastra.live-bus");

function bus(): LiveBus {
  const scope = globalThis as unknown as { [key: symbol]: unknown };
  const existing = scope[BUS_KEY] as LiveBus | undefined;
  if (existing) return existing;
  const created: LiveBus = { listeners: new Set(), seq: 0 };
  scope[BUS_KEY] = created;
  return created;
}

/**
 * Tell every open stream for these audiences that something changed. Payloads
 * are deliberately empty: the client refetches through the normal read path,
 * so one source of truth stays authoritative. A listener that throws (a dead
 * stream) must never break the caller that created the notification.
 */
export function publishLive(topic: LiveTopic, audience: string | string[]): void {
  const state = bus();
  const targets = Array.isArray(audience) ? audience : [audience];
  for (const target of targets) {
    state.seq += 1;
    const event: LiveEvent = { topic, audience: target, seq: state.seq, at: Date.now() };
    for (const listener of state.listeners) {
      try {
        listener(event);
      } catch {
        /* the stream is already gone; its cleanup will unsubscribe */
      }
    }
  }
}

export function subscribeLive(listener: Listener): () => void {
  const state = bus();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** Open streams — surfaced by the health check so a leak is visible. */
export function liveStreamCount(): number {
  return bus().listeners.size;
}

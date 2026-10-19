"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Change topics carried by /api/live. Keep in sync with LiveTopic in
 * `@/lib/live-bus` — the bus is server-only, so the union is mirrored here.
 */
export type LiveTopic = "inbox" | "chat" | "presence" | "room" | "pool";

/** Keeps the newest value reachable from callbacks that outlive one render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

interface LiveRevisionOptions<T> {
  /**
   * Cheap read that doubles as a change signal — a count and the newest id,
   * not the whole payload. Small enough to poll every few seconds on every
   * open surface.
   */
  read: () => Promise<T>;
  /**
   * Runs whenever the signal differs from the previous one. `previous` is
   * null on the very first observation (the page just rendered with fresh
   * data), so callers can skip a pointless refetch right after mount.
   */
  onChange: (value: T, previous: T | null) => void;
  /** How often to ask while the tab is visible. */
  intervalMs: number;
  enabled?: boolean;
}

/**
 * Fallback sync loop: polls a tiny revision and refetches only when it moved.
 *
 * With the SSE channel in front of it this is the safety net, not the primary
 * path — it covers a blocked stream, a proxy that buffers, and anything the
 * push channel cannot see. It also re-checks the instant the tab becomes
 * visible or focused, which is exactly the moment an update used to require a
 * manual reload.
 */
export function useLiveRevision<T>({
  read,
  onChange,
  intervalMs,
  enabled = true,
}: LiveRevisionOptions<T>) {
  const readRef = useLatest(read);
  const onChangeRef = useLatest(onChange);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const lastRef = useRef<{ key: string; value: T } | null>(null);

  const sample = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const value = await readRef.current();
      if (!mountedRef.current) return;
      const key = JSON.stringify(value) ?? "null";
      const previous = lastRef.current;
      if (previous?.key === key) return;
      lastRef.current = { key, value };
      onChangeRef.current(value, previous ? previous.value : null);
    } catch {
      // Offline, signed out, or a transient blip: stay quiet and retry.
    } finally {
      inFlightRef.current = false;
    }
  }, [readRef, onChangeRef]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onWake = () => {
      if (document.visibilityState === "visible") void sample();
    };
    void sample();
    const timer = window.setInterval(onWake, intervalMs);
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [enabled, intervalMs, sample]);
}

/**
 * The document's one stream.
 *
 * Each mounted surface used to open its own EventSource, on the assumption
 * that the browser shares the TCP connection underneath. It does not for SSE:
 * the response never completes, so every stream holds a connection slot, and a
 * page with three live surfaces (the notification bell, the room, the presence
 * strip) leaves the browser's six-per-host budget nearly spent — at which point
 * the page's own fetches start queueing behind them. One shared stream with a
 * per-topic subscriber set fixes that, and every surface still gets only the
 * topics it asked for.
 */
interface SharedStream {
  source: EventSource;
  listeners: Map<LiveTopic, Set<() => void>>;
}

let shared: SharedStream | null = null;

function subscribeTopic(topic: LiveTopic, handler: () => void): () => void {
  if (typeof EventSource === "undefined") return () => {};

  if (!shared) {
    let source: EventSource;
    try {
      source = new EventSource("/api/live");
    } catch {
      return () => {}; // blocked by the browser — the revision loop covers us
    }
    const listeners = new Map<LiveTopic, Set<() => void>>();
    for (const name of ["inbox", "chat", "presence", "room", "pool"] as const) {
      const set = new Set<() => void>();
      listeners.set(name, set);
      source.addEventListener(name, () => {
        for (const listener of set) listener();
      });
    }
    shared = { source, listeners };
  }

  const set = shared.listeners.get(topic);
  if (!set) return () => {};
  set.add(handler);

  return () => {
    set.delete(handler);
    const quiet = [...(shared?.listeners.values() ?? [])].every((subs) => subs.size === 0);
    // Last surface unmounted: a page with nothing live to show should not hold
    // a connection open.
    if (quiet) {
      shared?.source.close();
      shared = null;
    }
  };
}

/**
 * Push channel. Hands each change straight to the caller, so a new
 * notification, chat message or arrival in the room lands in well under a
 * second.
 *
 * It is intentionally fire-and-forget: if EventSource is unavailable or the
 * stream is blocked, nothing throws — the caller's `useLiveRevision` loop
 * still keeps the surface honest. Writes stay in server actions, so a one-way
 * stream is all this needs (no WebSocket process to run or secure).
 */
export function useLiveStream(
  topics: readonly LiveTopic[],
  onEvent: (topic: LiveTopic) => void,
  enabled = true,
) {
  const handlerRef = useLatest(onEvent);
  const topicKey = topics.join(",");

  useEffect(() => {
    if (!enabled) return;
    const watched = topicKey.split(",").filter(Boolean) as LiveTopic[];
    const unsubscribes = watched.map((topic) =>
      subscribeTopic(topic, () => handlerRef.current(topic)),
    );
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [enabled, topicKey, handlerRef]);
}

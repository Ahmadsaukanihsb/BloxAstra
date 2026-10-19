"use client";

import { useCallback, useState } from "react";
import { useLiveRevision, useLiveStream, type LiveTopic } from "@/lib/live";

interface LiveCountOptions<T> {
  /** Server-rendered first value, so the badge is right in the first paint. */
  initial: T;
  /** The action/signal that re-reads the value (a small count or list). */
  read: () => Promise<T>;
  /** Topic whose push means "the value may have moved". */
  topic: LiveTopic;
  /** Safety-net poll interval for a blocked or buffered stream. */
  intervalMs: number;
  enabled?: boolean;
}

/**
 * A value kept live: server-rendered `initial`, refreshed the moment its topic
 * pushes (under a second), with a poll underneath as the safety net.
 *
 * Three surfaces used to hand-roll this identical loop — the seller-group badge
 * (chat topic), the order badge (inbox), and the seller-room presence strip
 * (presence) — with three intervals and no stated reason for the differences.
 */
export function useLiveCount<T>({
  initial,
  read,
  topic,
  intervalMs,
  enabled = true,
}: LiveCountOptions<T>): T {
  const [value, setValue] = useState(initial);

  const sample = useCallback(async () => {
    try {
      setValue(await read());
    } catch {
      // Signed out or a transient blip: the last known value beats a flicker.
    }
  }, [read]);

  useLiveStream(
    [topic],
    () => {
      void sample();
    },
    enabled,
  );

  useLiveRevision({
    read,
    intervalMs,
    enabled,
    onChange: (next) => setValue(next),
  });

  return value;
}

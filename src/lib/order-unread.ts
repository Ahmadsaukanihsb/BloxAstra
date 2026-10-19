"use client";

import { useCallback, useState } from "react";
import { fetchOrderUnreadTotal } from "@/app/actions/room";
import { useLiveRevision, useLiveStream } from "@/lib/live";

/**
 * Unread order-chat messages across every order, kept live.
 *
 * `initial` comes from the server so the "Pesanan" badge is correct in the
 * first paint; every chat message also notifies the other side, so the inbox
 * topic is the push signal. The poll underneath is the safety net for a
 * blocked stream.
 */
export function useOrderUnread(initial: number, enabled = true): number {
  const [unread, setUnread] = useState(initial);

  const sample = useCallback(async () => {
    try {
      setUnread(await fetchOrderUnreadTotal());
    } catch {
      // Signed out or a blip: the last known number is better than a flicker.
    }
  }, []);

  useLiveStream(
    ["inbox"],
    () => {
      void sample();
    },
    enabled,
  );

  useLiveRevision({
    read: fetchOrderUnreadTotal,
    intervalMs: 60_000,
    enabled,
    onChange: (value) => setUnread(value),
  });

  return unread;
}

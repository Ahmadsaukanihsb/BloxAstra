"use client";

import { useCallback, useState } from "react";
import { fetchSellerChatUnread } from "@/app/actions/seller";
import { useLiveRevision, useLiveStream } from "@/lib/live";

/**
 * Unread seller-group messages, kept live.
 *
 * `initial` comes from the server, so the badge is already right in the first
 * paint of the sidebar and the bottom bar; from there the push channel keeps it
 * current — one message posted in the room wakes every open page — with the
 * poll underneath as the safety net for a blocked stream.
 *
 * This is deliberately not the notification bell's number: that one counts the
 * inbox (orders, money, disputes) in red. This counts one room in brand astra,
 * so the two badges never read as the same thing.
 */
export function useGroupChatUnread(initial: number, enabled = true): number {
  const [unread, setUnread] = useState(initial);

  const sample = useCallback(async () => {
    try {
      setUnread(await fetchSellerChatUnread());
    } catch {
      // Signed out or a blip: the last known number is better than a flicker.
    }
  }, []);

  useLiveStream(
    ["chat"],
    () => {
      void sample();
    },
    enabled,
  );

  useLiveRevision({
    read: fetchSellerChatUnread,
    intervalMs: 60_000,
    enabled,
    onChange: (value) => setUnread(value),
  });

  return unread;
}

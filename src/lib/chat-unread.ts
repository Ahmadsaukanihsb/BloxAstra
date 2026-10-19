"use client";

import { fetchSellerChatUnread } from "@/app/actions/seller";
import { useLiveCount } from "@/lib/live-count";

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
  return useLiveCount({
    initial,
    read: fetchSellerChatUnread,
    topic: "chat",
    intervalMs: 60_000,
    enabled,
  });
}

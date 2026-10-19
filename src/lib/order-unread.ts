"use client";

import { fetchOrderUnreadTotal } from "@/app/actions/room";
import { useLiveCount } from "@/lib/live-count";

/**
 * Unread order-chat messages across every order, kept live.
 *
 * `initial` comes from the server so the "Pesanan" badge is correct in the
 * first paint; every chat message also notifies the other side, so the inbox
 * topic is the push signal. The poll underneath is the safety net for a
 * blocked stream.
 */
export function useOrderUnread(initial: number, enabled = true): number {
  return useLiveCount({
    initial,
    read: fetchOrderUnreadTotal,
    topic: "inbox",
    intervalMs: 60_000,
    enabled,
  });
}

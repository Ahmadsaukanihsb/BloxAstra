"use client";

import { fetchSellerChatPresence } from "@/app/actions/seller";
import { useLiveCount } from "@/lib/live-count";
import type { OnlineSeller } from "@/lib/presence";

export type { OnlineSeller };

/**
 * Who is online in the seller room, kept live.
 *
 * The list comes from open realtime streams, so the push channel is the natural
 * updater: joining or leaving wakes every open room through the `presence`
 * topic. The poll underneath only exists for a blocked stream — and because the
 * server ages entries out on heartbeats, a stream that dies silently still
 * leaves the list on its own.
 */
export function useChatPresence(initial: OnlineSeller[]): OnlineSeller[] {
  return useLiveCount({
    initial,
    read: fetchSellerChatPresence,
    topic: "presence",
    intervalMs: 45_000,
  });
}

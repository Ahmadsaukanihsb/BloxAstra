"use client";

import { useCallback, useState } from "react";
import { fetchSellerChatPresence } from "@/app/actions/seller";
import { useLiveRevision, useLiveStream } from "@/lib/live";
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
  const [online, setOnline] = useState(initial);

  const sample = useCallback(async () => {
    try {
      setOnline(await fetchSellerChatPresence());
    } catch {
      // Offline or a blip: the last list is better than an empty room.
    }
  }, []);

  useLiveStream(["presence"], () => {
    void sample();
  });

  useLiveRevision({
    read: fetchSellerChatPresence,
    intervalMs: 45_000,
    onChange: (value) => setOnline(value),
  });

  return online;
}

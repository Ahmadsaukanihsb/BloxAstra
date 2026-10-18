"use client";

import { useRouter } from "next/navigation";
import { fetchInboxRevision } from "@/app/actions/notifications";
import { useLiveRevision, useLiveStream } from "@/lib/live";

/**
 * Invisible companion for the inbox page: keeps the archive current while it
 * is open, so a new notification never means "reload first". The push channel
 * refreshes it the moment something lands; the revision loop underneath is the
 * fallback for a blocked stream and for the moment the tab regains focus.
 */
export function LiveInboxRefresh() {
  const router = useRouter();
  useLiveStream(["inbox"], () => router.refresh());
  useLiveRevision({
    read: fetchInboxRevision,
    intervalMs: 60_000,
    onChange: (_revision, previous) => {
      // First sample is the state this page already rendered with.
      if (!previous) return;
      router.refresh();
    },
  });
  return null;
}

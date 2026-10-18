"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  getInboxRevision,
  getNotifications,
  markAllRead,
  type InboxRevision,
  type NotificationItem,
} from "@/lib/notifications";

/**
 * Change signal for the bell. Cheap enough to poll every few seconds; the
 * client only refetches the panel when this actually moves.
 */
export async function fetchInboxRevision(): Promise<InboxRevision> {
  try {
    const user = await requireUser();
    return await getInboxRevision(user.id);
  } catch {
    return { unread: 0, latestId: null };
  }
}

/** Latest items for the floating panel (compact, no page navigation needed). */
export async function fetchNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
  const user = await requireUser();
  const items = await getNotifications(user.id, 12);
  return { items, unread: items.filter((item) => !item.read).length };
}

export async function markNotificationsRead(): Promise<{ ok: true }> {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifikasi");
  return { ok: true };
}

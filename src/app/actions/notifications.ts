"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getNotifications, getUnreadCount, markAllRead, type NotificationItem } from "@/lib/notifications";

export async function fetchUnreadCount(): Promise<number> {
  try {
    const user = await requireUser();
    return await getUnreadCount(user.id);
  } catch {
    return 0;
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

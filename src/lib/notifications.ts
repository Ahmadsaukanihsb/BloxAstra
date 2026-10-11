import "server-only";
import { db } from "@/lib/db";

export type NotificationKind =
  | "order_paid"
  | "order_processing"
  | "order_shipped"
  | "order_completed"
  | "order_refunded"
  | "order_cancelled"
  | "dispute_opened"
  | "dispute_resolved"
  | "withdrawal_submitted"
  | "withdrawal_decided"
  | "review_received"
  | "chat_message"
  | "pool_refunded"
  | "kyc_submitted"
  | "kyc_approved"
  | "kyc_rejected"
  | "topup_paid";
export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** Drop one inbox row. Fire-and-forget safe — never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error("notify failed", input.kind, input.userId, error);
  }
}

/** Drop the same inbox row for many users (e.g. all admins). */
export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? null,
      })),
    });
  } catch (error) {
    console.error("notifyMany failed", input.kind, error);
  }
}

/** All admin user ids — for dispute/withdrawal escalations. */
export async function adminUserIds(): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function getNotifications(userId: string, limit = 60): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, kind: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

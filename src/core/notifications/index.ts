import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/core/db/client";
import { notification, type Notification } from "@/core/db/schema";

export async function createNotification(entry: {
  memberId: string;
  kind: string;
  entityRef?: string;
  payload?: Record<string, unknown>;
}): Promise<Notification> {
  const [row] = await db
    .insert(notification)
    .values({
      memberId: entry.memberId,
      kind: entry.kind,
      entityRef: entry.entityRef ?? null,
      payload: entry.payload ?? {},
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create notification");
  }
  return row;
}

export async function listNotifications(memberId: string, limit = 20): Promise<Notification[]> {
  return db
    .select()
    .from(notification)
    .where(eq(notification.memberId, memberId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(memberId: string): Promise<number> {
  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.memberId, memberId), isNull(notification.readAt)));
  return rows.length;
}

export async function markNotificationRead(id: string): Promise<void> {
  await db.update(notification).set({ readAt: new Date() }).where(eq(notification.id, id));
}

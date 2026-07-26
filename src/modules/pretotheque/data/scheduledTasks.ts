import { and, eq, lt } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { logActivity } from "@/core/activity";
import { addDays, today, type CalendarDate } from "@/core/date";

/**
 * A pending request whose whole window has already passed was never acted
 * on in time — rejecting it (rather than leaving it pending forever) keeps
 * "À valider" honest and frees the borrower to ask again with new dates.
 */
export async function expireStalePendingRequests(): Promise<number> {
  const stale = await db
    .select({ booking, itemName: item.name })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(eq(booking.status, "pending"), lt(booking.endDate, today())));

  for (const { booking: b, itemName } of stale) {
    await db
      .update(booking)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(booking.id, b.id));

    await logActivity({
      section: "pretotheque",
      kind: "booking.expired",
      actorId: b.borrowerId,
      subjectRef: `booking:${b.id}`,
      payload: { itemName },
    });
    await createNotification({
      memberId: b.borrowerId,
      kind: "booking.expired",
      entityRef: `booking:${b.id}`,
      payload: { itemName },
    });
  }

  return stale.length;
}

/**
 * One reminder per booking, the day before pickup — checks for an existing
 * `booking.pickup-reminder` notification on the same booking instead of a
 * dedicated "already reminded" column, since this only ever needs to fire once.
 */
export async function sendPickupReminders(): Promise<number> {
  const tomorrow = addDays(today(), 1);

  const dueTomorrow = await db
    .select({ booking, itemName: item.name })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(eq(booking.status, "approved"), eq(booking.startDate, tomorrow)));

  let sent = 0;
  for (const { booking: b, itemName } of dueTomorrow) {
    const alreadySent = await db.query.notification.findFirst({
      where: (n, { and, eq }) =>
        and(eq(n.entityRef, `booking:${b.id}`), eq(n.kind, "booking.pickup-reminder")),
    });
    if (alreadySent) continue;

    await createNotification({
      memberId: b.borrowerId,
      kind: "booking.pickup-reminder",
      entityRef: `booking:${b.id}`,
      payload: { itemName, startDate: b.startDate as CalendarDate },
    });
    sent += 1;
  }

  return sent;
}

export interface ScheduledTasksSummary {
  expired: number;
  remindersSent: number;
}

export async function runScheduledTasks(): Promise<ScheduledTasksSummary> {
  const [expired, remindersSent] = await Promise.all([
    expireStalePendingRequests(),
    sendPickupReminders(),
  ]);
  return { expired, remindersSent };
}

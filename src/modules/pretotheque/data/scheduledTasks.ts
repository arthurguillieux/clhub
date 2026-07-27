import { and, eq, lt, lte } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { wantsEmail } from "@/core/notifications/preferences";
import { logActivity } from "@/core/activity";
import { addDays, formatFrench, today, type CalendarDate } from "@/core/date";
import { syncAllAchievements } from "@/core/achievements/engine";
import { sendMail } from "@/core/mail/send";
import { OverdueBorrowerEmail } from "@/core/mail/templates/OverdueBorrowerEmail";
import { OverdueOwnerEmail } from "@/core/mail/templates/OverdueOwnerEmail";

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

/**
 * J+1: the borrower gets a nudge as soon as an active loan is at least one
 * day past its return date. Always creates the in-app notification; the
 * email on top honors the borrower's own preference (docs/03-roadmap.md).
 */
export async function sendOverdueBorrowerReminders(): Promise<number> {
  const overdue = await db
    .select({ booking, itemName: item.name, ownerId: item.ownerId })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(eq(booking.status, "active"), lt(booking.endDate, today())));

  let sent = 0;
  for (const { booking: b, itemName, ownerId } of overdue) {
    const alreadySent = await db.query.notification.findFirst({
      where: (n, { and, eq }) =>
        and(eq(n.entityRef, `booking:${b.id}`), eq(n.kind, "booking.overdue-borrower")),
    });
    if (alreadySent) continue;

    await createNotification({
      memberId: b.borrowerId,
      kind: "booking.overdue-borrower",
      entityRef: `booking:${b.id}`,
      payload: { itemName, endDate: b.endDate as CalendarDate },
    });

    const borrowerMember = await db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, b.borrowerId) });
    if (borrowerMember && wantsEmail(borrowerMember.notifPrefs, "overdueReminder")) {
      const [borrowerUser, ownerMember] = await Promise.all([
        db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, borrowerMember.userId) }),
        db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, ownerId) }),
      ]);
      const ownerUser = ownerMember
        ? await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, ownerMember.userId) })
        : null;
      if (borrowerUser && ownerUser) {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        await sendMail({
          to: borrowerUser.email,
          subject: `LE CLHUB — ${itemName} est en retard`,
          react: OverdueBorrowerEmail({
            itemName,
            ownerName: ownerUser.name,
            endDateLabel: formatFrench(b.endDate as CalendarDate),
            appUrl,
          }),
          devFallbackMessage: `Overdue reminder to borrower ${borrowerUser.email} re ${itemName}`,
        });
      }
    }
    sent += 1;
  }

  return sent;
}

/**
 * J+3: the owner is looped in once a loan is at least three days overdue —
 * the borrower's already had two days' notice on their own. Same
 * always-notify / preference-gated-email split as the borrower reminder.
 */
export async function sendOverdueOwnerReminders(): Promise<number> {
  const threshold = addDays(today(), -3);

  const overdue = await db
    .select({ booking, itemName: item.name, ownerId: item.ownerId })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(eq(booking.status, "active"), lte(booking.endDate, threshold)));

  let sent = 0;
  for (const { booking: b, itemName, ownerId } of overdue) {
    const alreadySent = await db.query.notification.findFirst({
      where: (n, { and, eq }) => and(eq(n.entityRef, `booking:${b.id}`), eq(n.kind, "booking.overdue-owner")),
    });
    if (alreadySent) continue;

    await createNotification({
      memberId: ownerId,
      kind: "booking.overdue-owner",
      entityRef: `booking:${b.id}`,
      payload: { itemName, endDate: b.endDate as CalendarDate },
    });

    const ownerMember = await db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, ownerId) });
    if (ownerMember && wantsEmail(ownerMember.notifPrefs, "overdueReminder")) {
      const [ownerUser, borrowerMember] = await Promise.all([
        db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, ownerMember.userId) }),
        db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, b.borrowerId) }),
      ]);
      const borrowerUser = borrowerMember
        ? await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, borrowerMember.userId) })
        : null;
      if (ownerUser && borrowerUser) {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        await sendMail({
          to: ownerUser.email,
          subject: `LE CLHUB — ${itemName} n'est toujours pas rendu`,
          react: OverdueOwnerEmail({
            itemName,
            borrowerName: borrowerUser.name,
            endDateLabel: formatFrench(b.endDate as CalendarDate),
            appUrl,
          }),
          devFallbackMessage: `Overdue reminder to owner ${ownerUser.email} re ${itemName}`,
        });
      }
    }
    sent += 1;
  }

  return sent;
}

export interface ScheduledTasksSummary {
  expired: number;
  remindersSent: number;
  overdueBorrowerRemindersSent: number;
  overdueOwnerRemindersSent: number;
  badgesUnlocked: number;
}

export async function runScheduledTasks(): Promise<ScheduledTasksSummary> {
  const [expired, remindersSent, overdueBorrowerRemindersSent, overdueOwnerRemindersSent, badgesUnlocked] =
    await Promise.all([
      expireStalePendingRequests(),
      sendPickupReminders(),
      sendOverdueBorrowerReminders(),
      sendOverdueOwnerReminders(),
      syncAllAchievements(),
    ]);
  return { expired, remindersSent, overdueBorrowerRemindersSent, overdueOwnerRemindersSent, badgesUnlocked };
}

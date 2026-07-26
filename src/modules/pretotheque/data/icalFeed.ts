import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item, member, user } from "@/core/db/schema";
import { addDays, type CalendarDate } from "@/core/date";
import { buildIcsCalendar, type IcsEvent } from "@/core/ical";

/** Confirmed-or-ongoing loans only — pending requests aren't real commitments yet. */
const FEED_STATUSES = ["approved", "active"] as const;

export async function getOrCreateCalendarToken(memberId: string): Promise<string> {
  const existing = await db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, memberId) });
  if (!existing) {
    throw new Error("Member not found");
  }
  if (existing.calendarToken) {
    return existing.calendarToken;
  }

  const token = randomBytes(24).toString("base64url");
  await db.update(member).set({ calendarToken: token }).where(eq(member.id, memberId));
  return token;
}

export async function buildIcsFeedForToken(token: string): Promise<string | null> {
  const owner = await db.query.member.findFirst({ where: (m, { eq }) => eq(m.calendarToken, token) });
  if (!owner) return null;

  const ownerUser = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, owner.userId) });
  const displayName = ownerUser?.name ?? "Membre";

  const borrowed = await db
    .select({ booking, itemName: item.name })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(eq(booking.borrowerId, owner.id), inArray(booking.status, FEED_STATUSES)));

  const lent = await db
    .select({ booking, itemName: item.name, borrowerName: user.name })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .innerJoin(member, eq(member.id, booking.borrowerId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(item.ownerId, owner.id), inArray(booking.status, FEED_STATUSES)));

  const events: IcsEvent[] = [
    ...borrowed.map(
      (row): IcsEvent => ({
        uid: `${row.booking.id}@le-clhub`,
        summary: `Emprunt : ${row.itemName}`,
        startDate: row.booking.startDate,
        endDateExclusive: addDays(row.booking.endDate as CalendarDate, 1),
      }),
    ),
    ...lent.map(
      (row): IcsEvent => ({
        uid: `${row.booking.id}-lent@le-clhub`,
        summary: `Prêté à ${row.borrowerName} : ${row.itemName}`,
        startDate: row.booking.startDate,
        endDateExclusive: addDays(row.booking.endDate as CalendarDate, 1),
      }),
    ),
  ];

  return buildIcsCalendar(`LE CLHUB — ${displayName}`, events);
}

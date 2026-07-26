import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item, waitlistEntry, type WaitlistEntry } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { type CalendarDate } from "@/core/date";
import { busyRanges, canBook, combinedBusyRanges } from "@/modules/pretotheque/domain/availability";
import { listActiveUnitsForItem } from "@/modules/pretotheque/data/itemUnits";

/**
 * Signing up again for the same item replaces any not-yet-notified entry —
 * one live "prévens-moi" per member per item, always for their latest ask.
 */
export async function joinWaitlist(
  itemId: string,
  memberId: string,
  startDate: string,
  endDate: string,
): Promise<WaitlistEntry> {
  await db
    .delete(waitlistEntry)
    .where(
      and(
        eq(waitlistEntry.itemId, itemId),
        eq(waitlistEntry.memberId, memberId),
        isNull(waitlistEntry.notifiedAt),
      ),
    );

  const [created] = await db
    .insert(waitlistEntry)
    .values({ itemId, memberId, startDate, endDate })
    .returning();
  if (!created) {
    throw new Error("Failed to create waitlist entry");
  }
  return created;
}

export async function leaveWaitlist(entryId: string, memberId: string): Promise<void> {
  await db
    .delete(waitlistEntry)
    .where(and(eq(waitlistEntry.id, entryId), eq(waitlistEntry.memberId, memberId)));
}

export interface WaitlistEntryWithItem extends WaitlistEntry {
  itemName: string;
  itemSlug: string;
}

/** "Mes listes d'attente" on the member dashboard, most recent first. */
export async function listWaitlistForMember(memberId: string): Promise<WaitlistEntryWithItem[]> {
  const rows = await db
    .select({ waitlistEntry, itemName: item.name, itemSlug: item.slug })
    .from(waitlistEntry)
    .innerJoin(item, eq(item.id, waitlistEntry.itemId))
    .where(eq(waitlistEntry.memberId, memberId))
    .orderBy(desc(waitlistEntry.createdAt));

  return rows.map((r) => ({ ...r.waitlistEntry, itemName: r.itemName, itemSlug: r.itemSlug }));
}

/**
 * Called after any change that can free up an item (cancellation, rejection,
 * return). Re-checks every not-yet-notified waitlist entry against the
 * item's current busy ranges and notifies the ones that now fit — same
 * `canBook` the booking form itself uses, so "libre" here always means
 * "the request would actually succeed". Combines busy ranges across every
 * active unit (ADR-004): an item with several copies is only actually busy
 * when all of them are.
 */
export async function notifyWaitlistIfFreed(itemId: string): Promise<void> {
  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, itemId) });
  if (!targetItem) return;

  const pending = await db
    .select()
    .from(waitlistEntry)
    .where(and(eq(waitlistEntry.itemId, itemId), isNull(waitlistEntry.notifiedAt)));
  if (pending.length === 0) return;

  const units = await listActiveUnitsForItem(itemId);
  const unitBookings =
    units.length === 0
      ? []
      : await db.select().from(booking).where(inArray(booking.unitId, units.map((u) => u.id)));
  const perUnitBusy = units.map((u) =>
    busyRanges(
      unitBookings
        .filter((b) => b.unitId === u.id)
        .map((b) => ({
          range: { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
          status: b.status,
        })),
      targetItem.bufferDays,
    ),
  );
  const busy = combinedBusyRanges(perUnitBusy);

  for (const entry of pending) {
    const check = canBook(
      { start: entry.startDate as CalendarDate, end: entry.endDate as CalendarDate },
      busy,
      { maxLoanDays: targetItem.maxLoanDays, bufferDays: targetItem.bufferDays },
    );
    if (!check.ok) continue;

    await createNotification({
      memberId: entry.memberId,
      kind: "waitlist.available",
      entityRef: `item:${itemId}`,
      payload: {
        itemName: targetItem.name,
        itemSlug: targetItem.slug,
        startDate: entry.startDate,
        endDate: entry.endDate,
      },
    });
    await db
      .update(waitlistEntry)
      .set({ notifiedAt: new Date() })
      .where(eq(waitlistEntry.id, entry.id));
  }
}

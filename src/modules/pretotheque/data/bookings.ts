import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item, member, user, type Booking, type Item } from "@/core/db/schema";
import { logActivity } from "@/core/activity";
import { createNotification } from "@/core/notifications";
import { createActionToken } from "@/core/action-tokens";
import { addDays, compare, formatFrench, parse, today, type CalendarDate } from "@/core/date";
import { sendMail } from "@/core/mail/send";
import { BookingRequestEmail } from "@/core/mail/templates/BookingRequestEmail";
import {
  busyRanges,
  canBook,
  combinedBusyRanges,
  findAvailableUnitIndex,
  suggestAlternatives,
  type Range,
} from "@/modules/pretotheque/domain/availability";
import { listActiveUnitsForItem } from "@/modules/pretotheque/data/itemUnits";
import { notifyWaitlistIfFreed } from "@/modules/pretotheque/data/waitlist";

export interface BookingRequestInput {
  itemId: string;
  borrowerId: string;
  startDate: string; // CalendarDate-shaped "YYYY-MM-DD"
  endDate: string;
  message?: string | null;
  /** Set when this request is one item of a "chantier" — see project.ts. */
  projectId?: string | null;
}

export type BookingRequestResult =
  | { ok: true; booking: Booking; status: "pending" | "approved" }
  | { ok: false; reason: "item-not-found" }
  | { ok: false; reason: "item-unavailable" } // item is broken/retired/unavailable
  | { ok: false; reason: "db-conflict" } // exclusion constraint caught a genuine race
  | { ok: false; reason: "invalid-range" }
  | { ok: false; reason: "too-long"; requestedDays: number; maxDays: number }
  // suggestions: up to 3 free ranges of the same length nearby, so a rejection
  // comes with "libre du 15 au 18" instead of a bare "c'est pris".
  | { ok: false; reason: "overlap"; conflictingRange: Range; suggestions: Range[] };

export async function listBookingsForUnit(unitId: string): Promise<Booking[]> {
  return db.select().from(booking).where(eq(booking.unitId, unitId));
}

async function listBookingsForUnits(unitIds: string[]): Promise<Booking[]> {
  if (unitIds.length === 0) return [];
  return db.select().from(booking).where(inArray(booking.unitId, unitIds));
}

export interface BookingWithBorrower extends Booking {
  borrowerName: string;
}

export async function listBookingsWithBorrowerForItem(
  itemId: string,
): Promise<BookingWithBorrower[]> {
  const rows = await db
    .select({ booking, borrowerName: user.name })
    .from(booking)
    .innerJoin(member, eq(member.id, booking.borrowerId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(booking.itemId, itemId));

  return rows.map((row) => ({ ...row.booking, borrowerName: row.borrowerName }));
}

export interface BookingWithItem extends Booking {
  item: Item;
  borrowerName: string;
}

export async function getBookingWithItem(bookingId: string): Promise<BookingWithItem | null> {
  const row = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!row) return null;

  const [relatedItem, borrowerMember] = await Promise.all([
    db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, row.itemId) }),
    db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, row.borrowerId) }),
  ]);
  if (!relatedItem || !borrowerMember) return null;

  const borrowerUser = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, borrowerMember.userId),
  });

  return { ...row, item: relatedItem, borrowerName: borrowerUser?.name ?? "Un membre" };
}

export type RespondResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "forbidden" } // respondedBy isn't the item's owner
  | { ok: false; reason: "already-responded" }
  | { ok: false; reason: "conflict" }; // exclusion constraint — dates got taken since the request was made

/**
 * Approves or rejects a pending request. `respondedBy` must be the item's
 * owner — the email-token flow already guarantees this (the token is minted
 * for the owner), but this check is what actually protects the in-app
 * dashboard action, where any logged-in member could otherwise pass any
 * bookingId. Approving can still race another booking confirmed in the
 * meantime — same exclusion-constraint safety net as createBookingRequest.
 */
export async function respondToBooking(
  bookingId: string,
  decision: "approved" | "rejected",
  respondedBy: string,
): Promise<RespondResult> {
  const existing = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!existing) return { ok: false, reason: "not-found" };

  const relatedItem = await db.query.item.findFirst({
    where: (i, { eq }) => eq(i.id, existing.itemId),
  });
  if (!relatedItem || relatedItem.ownerId !== respondedBy) {
    return { ok: false, reason: "forbidden" };
  }

  if (existing.status !== "pending") return { ok: false, reason: "already-responded" };

  try {
    const [updated] = await db
      .update(booking)
      .set({ status: decision, respondedAt: new Date(), respondedBy, updatedAt: new Date() })
      .where(eq(booking.id, bookingId))
      .returning();
    if (!updated) return { ok: false, reason: "not-found" };
    return { ok: true, booking: updated };
  } catch (error) {
    if (isExclusionViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23P01"
  );
}

/**
 * The application-level check below (canBook) exists to give a clear,
 * specific rejection reason — it is not what actually prevents double
 * bookings. That guarantee is the Postgres exclusion constraint (see
 * docs/02-architecture.md §3.3): if two requests race past this check at
 * the same instant, the second INSERT fails and we translate that into
 * "db-conflict" instead of a generic 500.
 */
export async function createBookingRequest(
  input: BookingRequestInput,
): Promise<BookingRequestResult> {
  const targetItem = await db.query.item.findFirst({
    where: (i, { eq }) => eq(i.id, input.itemId),
  });
  if (!targetItem) {
    return { ok: false, reason: "item-not-found" };
  }
  if (targetItem.status !== "available") {
    return { ok: false, reason: "item-unavailable" };
  }

  const units = await listActiveUnitsForItem(input.itemId);
  if (units.length === 0) {
    return { ok: false, reason: "item-unavailable" };
  }

  const start = parse(input.startDate);
  const end = parse(input.endDate);

  const unitBookings = await listBookingsForUnits(units.map((u) => u.id));
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
  // Only fully-booked-on-every-unit stretches actually block a new request
  // (ADR-004) — reuses canBook/suggestAlternatives unchanged, since a
  // single-unit item is just the case where perUnitBusy has one entry.
  const overallBusy = combinedBusyRanges(perUnitBusy);

  const check = canBook(
    { start, end },
    overallBusy,
    { maxLoanDays: targetItem.maxLoanDays, bufferDays: targetItem.bufferDays },
  );
  if (!check.ok) {
    if (check.reason === "overlap") {
      const earliestSearch = compare(today(), addDays(start, -14)) > 0 ? today() : addDays(start, -14);
      const suggestions = suggestAlternatives(
        overallBusy,
        { start, end },
        { start: earliestSearch, end: addDays(end, 120) },
        3,
      );
      return { ok: false, reason: "overlap", conflictingRange: check.conflictingRange, suggestions };
    }
    return check;
  }

  const chosenUnit = units[findAvailableUnitIndex(perUnitBusy, { start, end })];
  if (!chosenUnit) {
    // Shouldn't happen: the combined check above just confirmed some unit is free.
    return { ok: false, reason: "db-conflict" };
  }

  const status = targetItem.autoApprove ? "approved" : "pending";

  let created: Booking | undefined;
  try {
    [created] = await db
      .insert(booking)
      .values({
        itemId: input.itemId,
        unitId: chosenUnit.id,
        borrowerId: input.borrowerId,
        startDate: input.startDate,
        endDate: input.endDate,
        message: input.message ?? null,
        projectId: input.projectId ?? null,
        status,
      })
      .returning();
  } catch (error) {
    if (isExclusionViolation(error)) {
      return { ok: false, reason: "db-conflict" };
    }
    throw error;
  }

  if (!created) {
    return { ok: false, reason: "db-conflict" };
  }

  await logActivity({
    section: "pretotheque",
    kind: status === "approved" ? "booking.approved" : "booking.requested",
    actorId: input.borrowerId,
    subjectRef: `booking:${created.id}`,
    payload: { itemName: targetItem.name, startDate: input.startDate, endDate: input.endDate },
  });

  await createNotification({
    memberId: targetItem.ownerId,
    kind: status === "approved" ? "booking.auto-approved" : "booking.requested",
    entityRef: `booking:${created.id}`,
    payload: { itemName: targetItem.name, startDate: input.startDate, endDate: input.endDate },
  });

  if (status === "pending") {
    await sendBookingRequestEmail(created, targetItem.name, targetItem.ownerId);
  }

  return { ok: true, booking: created, status };
}

async function sendBookingRequestEmail(
  createdBooking: Booking,
  itemName: string,
  ownerId: string,
): Promise<void> {
  const [ownerMember, borrowerMember] = await Promise.all([
    db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, ownerId) }),
    db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, createdBooking.borrowerId) }),
  ]);
  if (!ownerMember || !borrowerMember) return; // shouldn't happen — both were just referenced by FK

  const [ownerUser, borrowerUser] = await Promise.all([
    db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, ownerMember.userId) }),
    db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, borrowerMember.userId) }),
  ]);
  if (!ownerUser || !borrowerUser) return;

  const [approveToken, rejectToken] = await Promise.all([
    createActionToken(ownerId, "booking.approve", { bookingId: createdBooking.id }),
    createActionToken(ownerId, "booking.reject", { bookingId: createdBooking.id }),
  ]);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const startLabel = formatFrench(createdBooking.startDate as CalendarDate);
  const endLabel = formatFrench(createdBooking.endDate as CalendarDate);

  await sendMail({
    to: ownerUser.email,
    subject: `LE CLHUB — demande pour ${itemName}`,
    react: BookingRequestEmail({
      itemName,
      borrowerName: borrowerUser.name,
      startDateLabel: startLabel,
      endDateLabel: endLabel,
      message: createdBooking.message,
      approveUrl: `${appUrl}/valider/${approveToken}`,
      rejectUrl: `${appUrl}/valider/${rejectToken}`,
    }),
    devFallbackMessage: `Booking request email for ${ownerUser.email} — approve: ${appUrl}/valider/${approveToken} — reject: ${appUrl}/valider/${rejectToken}`,
  });
}

export type TransitionResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "wrong-status" };

async function notifyOwnerOfTransition(
  updatedBooking: Booking,
  kind: "booking.picked-up" | "booking.returned",
): Promise<void> {
  const relatedItem = await db.query.item.findFirst({
    where: (i, { eq }) => eq(i.id, updatedBooking.itemId),
  });
  if (!relatedItem) return;

  await logActivity({
    section: "pretotheque",
    kind,
    actorId: updatedBooking.borrowerId,
    subjectRef: `booking:${updatedBooking.id}`,
    payload: { itemName: relatedItem.name },
  });

  await createNotification({
    memberId: relatedItem.ownerId,
    kind,
    entityRef: `booking:${updatedBooking.id}`,
    payload: { itemName: relatedItem.name },
  });
}

/** Only the borrower confirms pickup/return — see docs/01-produit.md §5.3. */
export async function markPickedUp(bookingId: string, memberId: string): Promise<TransitionResult> {
  const existing = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.borrowerId !== memberId) return { ok: false, reason: "forbidden" };
  if (existing.status !== "approved") return { ok: false, reason: "wrong-status" };

  const [updated] = await db
    .update(booking)
    .set({ status: "active", pickedUpAt: new Date(), updatedAt: new Date() })
    .where(eq(booking.id, bookingId))
    .returning();
  if (!updated) return { ok: false, reason: "not-found" };

  await notifyOwnerOfTransition(updated, "booking.picked-up");
  return { ok: true, booking: updated };
}

export async function markReturned(
  bookingId: string,
  memberId: string,
  returnCondition?: string | null,
): Promise<TransitionResult> {
  const existing = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.borrowerId !== memberId) return { ok: false, reason: "forbidden" };
  if (existing.status !== "active") return { ok: false, reason: "wrong-status" };

  const [updated] = await db
    .update(booking)
    .set({
      status: "returned",
      returnedAt: new Date(),
      returnCondition: returnCondition ?? null,
      updatedAt: new Date(),
    })
    .where(eq(booking.id, bookingId))
    .returning();
  if (!updated) return { ok: false, reason: "not-found" };

  await notifyOwnerOfTransition(updated, "booking.returned");
  await notifyWaitlistIfFreed(updated.itemId);
  return { ok: true, booking: updated };
}

export interface BookingWithItemSummary extends Booking {
  itemName: string;
  itemSlug: string;
}

/** "Mes emprunts" — every booking this member has made, most recent first. */
export async function listBookingsByBorrower(memberId: string): Promise<BookingWithItemSummary[]> {
  const rows = await db
    .select({ booking, itemName: item.name, itemSlug: item.slug })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(eq(booking.borrowerId, memberId))
    .orderBy(desc(booking.startDate));

  return rows.map((r) => ({ ...r.booking, itemName: r.itemName, itemSlug: r.itemSlug }));
}

export interface PendingRequestForOwner extends Booking {
  itemName: string;
  itemSlug: string;
  borrowerName: string;
}

/** "À valider" — pending requests on items this member owns. */
export async function listPendingRequestsForOwner(
  memberId: string,
): Promise<PendingRequestForOwner[]> {
  const rows = await db
    .select({ booking, itemName: item.name, itemSlug: item.slug, borrowerName: user.name })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .innerJoin(member, eq(member.id, booking.borrowerId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(item.ownerId, memberId), eq(booking.status, "pending")))
    .orderBy(desc(booking.createdAt));

  return rows.map((r) => ({
    ...r.booking,
    itemName: r.itemName,
    itemSlug: r.itemSlug,
    borrowerName: r.borrowerName,
  }));
}

export interface PlanningBooking {
  id: string;
  itemId: string;
  startDate: string;
  endDate: string;
  status: string;
  borrowerName: string;
}

/**
 * Every booking touching `[windowStart, windowEnd]`, across every item —
 * the planning view's raw material. Pending requests are included (unlike
 * `busyRanges`) since the point of this view is to see everything at a
 * glance, confirmed or not.
 */
export async function listBookingsForPlanning(
  windowStart: string,
  windowEnd: string,
): Promise<PlanningBooking[]> {
  const rows = await db
    .select({ booking, borrowerName: user.name })
    .from(booking)
    .innerJoin(member, eq(member.id, booking.borrowerId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        inArray(booking.status, ["pending", "approved", "active"]),
        lte(booking.startDate, windowEnd),
        gte(booking.endDate, windowStart),
      ),
    );

  return rows.map((r) => ({
    id: r.booking.id,
    itemId: r.booking.itemId,
    startDate: r.booking.startDate,
    endDate: r.booking.endDate,
    status: r.booking.status,
    borrowerName: r.borrowerName,
  }));
}

export async function cancelBooking(bookingId: string, memberId: string): Promise<TransitionResult> {
  const existing = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.borrowerId !== memberId) return { ok: false, reason: "forbidden" };
  if (existing.status !== "pending" && existing.status !== "approved") {
    return { ok: false, reason: "wrong-status" };
  }

  const [updated] = await db
    .update(booking)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(booking.id, bookingId))
    .returning();
  if (!updated) return { ok: false, reason: "not-found" };

  const relatedItem = await db.query.item.findFirst({
    where: (i, { eq }) => eq(i.id, updated.itemId),
  });
  if (relatedItem) {
    await createNotification({
      memberId: relatedItem.ownerId,
      kind: "booking.cancelled",
      entityRef: `booking:${updated.id}`,
      payload: { itemName: relatedItem.name },
    });
  }
  if (existing.status === "approved") {
    // Only a confirmed booking actually blocked anything — cancelling a
    // still-pending request frees nothing new.
    await notifyWaitlistIfFreed(updated.itemId);
  }

  return { ok: true, booking: updated };
}

export type UpdateBookingDatesResult =
  | { ok: true; booking: Booking; revertedToPending: boolean }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "wrong-status" }
  | { ok: false; reason: "invalid-range" }
  | { ok: false; reason: "too-long"; requestedDays: number; maxDays: number }
  | { ok: false; reason: "overlap"; conflictingRange: Range; suggestions: Range[] }
  | { ok: false; reason: "db-conflict" };

/**
 * Backs "déplacer ou étirer sa réservation directement sur la grille"
 * (docs/01-produit.md §5.2). Re-runs the same `canBook` check as a fresh
 * request — against every *other* booking on the same unit (ADR-004), since
 * this one is itself being moved — so a drag can't sneak past validation a
 * manual request would have hit. An already-approved booking whose dates
 * actually change drops back to 'pending': the owner approved a specific
 * window, not "whatever the borrower drags it to".
 */
export async function updateBookingDates(
  bookingId: string,
  memberId: string,
  newStartDate: string,
  newEndDate: string,
): Promise<UpdateBookingDatesResult> {
  const existing = await db.query.booking.findFirst({ where: (b, { eq }) => eq(b.id, bookingId) });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.borrowerId !== memberId) return { ok: false, reason: "forbidden" };
  if (existing.status !== "pending" && existing.status !== "approved") {
    return { ok: false, reason: "wrong-status" };
  }
  if (existing.startDate === newStartDate && existing.endDate === newEndDate) {
    return { ok: true, booking: existing, revertedToPending: false };
  }

  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, existing.itemId) });
  if (!targetItem) return { ok: false, reason: "not-found" };

  const start = parse(newStartDate);
  const end = parse(newEndDate);

  // Scoped to this booking's own unit — a drag reschedules the borrower's
  // copy, it doesn't hand them a different one. Other units' bookings are
  // irrelevant here (unlike createBookingRequest, which is choosing among them).
  const otherBookings = (await listBookingsForUnit(existing.unitId)).filter((b) => b.id !== bookingId);
  const busy = busyRanges(
    otherBookings.map((b) => ({
      range: { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
      status: b.status,
    })),
    targetItem.bufferDays,
  );

  const check = canBook({ start, end }, busy, {
    maxLoanDays: targetItem.maxLoanDays,
    bufferDays: targetItem.bufferDays,
  });
  if (!check.ok) {
    if (check.reason === "overlap") {
      const earliestSearch = compare(today(), addDays(start, -14)) > 0 ? today() : addDays(start, -14);
      const suggestions = suggestAlternatives(
        busy,
        { start, end },
        { start: earliestSearch, end: addDays(end, 120) },
        3,
      );
      return { ok: false, reason: "overlap", conflictingRange: check.conflictingRange, suggestions };
    }
    return check;
  }

  const revertedToPending = existing.status === "approved";

  try {
    const [updated] = await db
      .update(booking)
      .set({
        startDate: newStartDate,
        endDate: newEndDate,
        status: revertedToPending ? "pending" : existing.status,
        updatedAt: new Date(),
      })
      .where(eq(booking.id, bookingId))
      .returning();
    if (!updated) return { ok: false, reason: "not-found" };

    if (revertedToPending) {
      await createNotification({
        memberId: targetItem.ownerId,
        kind: "booking.dates-changed",
        entityRef: `booking:${bookingId}`,
        payload: { itemName: targetItem.name, startDate: newStartDate, endDate: newEndDate },
      });
      await notifyWaitlistIfFreed(existing.itemId);
    }

    return { ok: true, booking: updated, revertedToPending };
  } catch (error) {
    if (isExclusionViolation(error)) return { ok: false, reason: "db-conflict" };
    throw error;
  }
}

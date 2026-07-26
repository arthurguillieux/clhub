import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, member, user, type Booking } from "@/core/db/schema";
import { logActivity } from "@/core/activity";
import { createNotification } from "@/core/notifications";
import { parse, type CalendarDate } from "@/core/date";
import { busyRanges, canBook, type BookingCheck } from "@/modules/pretotheque/domain/availability";

export interface BookingRequestInput {
  itemId: string;
  borrowerId: string;
  startDate: string; // CalendarDate-shaped "YYYY-MM-DD"
  endDate: string;
  message?: string | null;
}

// createBookingRequest never actually returns BookingCheck's bare `{ ok: true }`
// variant (only its failures get propagated), so pulling in the whole type
// would give the union an ambiguous, non-discriminating success case.
type BookingRejection = Extract<BookingCheck, { ok: false }>;

export type BookingRequestResult =
  | { ok: true; booking: Booking; status: "pending" | "approved" }
  | { ok: false; reason: "item-not-found" }
  | { ok: false; reason: "db-conflict" } // exclusion constraint caught a genuine race
  | BookingRejection;

export async function listBookingsForItem(itemId: string): Promise<Booking[]> {
  return db.select().from(booking).where(eq(booking.itemId, itemId));
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

  const start = parse(input.startDate);
  const end = parse(input.endDate);

  const existing = await listBookingsForItem(input.itemId);
  const busy = busyRanges(
    existing.map((b) => ({
      range: { start: b.startDate as CalendarDate, end: b.endDate as CalendarDate },
      status: b.status,
    })),
    targetItem.bufferDays,
  );

  const check = canBook(
    { start, end },
    busy,
    { maxLoanDays: targetItem.maxLoanDays, bufferDays: targetItem.bufferDays },
  );
  if (!check.ok) {
    return check;
  }

  const status = targetItem.autoApprove ? "approved" : "pending";

  let created: Booking | undefined;
  try {
    [created] = await db
      .insert(booking)
      .values({
        itemId: input.itemId,
        borrowerId: input.borrowerId,
        startDate: input.startDate,
        endDate: input.endDate,
        message: input.message ?? null,
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

  return { ok: true, booking: created, status };
}

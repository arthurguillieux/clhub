import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item, maintenanceLog, member } from "@/core/db/schema";
import { addDays, compare, diffDays, fromTimestamp, weekday, type CalendarDate } from "@/core/date";
import { UNBREAKABLE_ITEM_MIN_LOANS, type MemberStats } from "./catalog";

const COLLECTIVE_WEEKEND_MIN_MEMBERS = 5;
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

function overlapsWeekend(start: CalendarDate, end: CalendarDate, saturday: CalendarDate): boolean {
  const sunday = addDays(saturday, 1);
  return compare(start, sunday) <= 0 && compare(saturday, end) <= 0;
}

/**
 * Every member who has ever shared a weekend (Sat+Sun) with 5+ other
 * distinct borrowers — computed club-wide once since the condition isn't
 * about any one member's own history.
 */
async function computeCollectiveWeekendMemberIds(): Promise<Set<string>> {
  const rows = await db
    .select({ borrowerId: booking.borrowerId, startDate: booking.startDate, endDate: booking.endDate })
    .from(booking)
    .where(inArray(booking.status, ["approved", "active", "returned"]));

  const candidateSaturdays = new Set<CalendarDate>();
  for (const row of rows) {
    let cursor = row.startDate as CalendarDate;
    const end = row.endDate as CalendarDate;
    // Walk to the first Saturday on/after the start, then every 7 days through the range.
    cursor = addDays(cursor, (13 - weekday(cursor)) % 7); // weekday(): Mon=1..Sun=7, Saturday=6
    while (compare(cursor, end) <= 0) {
      candidateSaturdays.add(cursor);
      cursor = addDays(cursor, 7);
    }
  }

  const result = new Set<string>();
  for (const saturday of candidateSaturdays) {
    const borrowers = new Set(
      rows
        .filter((r) => overlapsWeekend(r.startDate as CalendarDate, r.endDate as CalendarDate, saturday))
        .map((r) => r.borrowerId),
    );
    if (borrowers.size >= COLLECTIVE_WEEKEND_MIN_MEMBERS) {
      for (const id of borrowers) result.add(id);
    }
  }
  return result;
}

export async function computeMemberStats(memberId: string): Promise<MemberStats> {
  // None of these depend on each other's results (the unbreakable-item
  // check below is the one exception — it needs ownedItems first) — firing
  // them together instead of one `await` at a time is most of what made
  // this function slow to begin with, since it runs on every Settings
  // page view via syncMemberAchievements.
  const [
    memberRow,
    ownedItems,
    returnedAsBorrower,
    approvedOnOwnedItems,
    referralCountRows,
    collectiveWeekendMembers,
    pickupsAsBorrower,
    completedBorrowCountRows,
  ] = await Promise.all([
    db.query.member.findFirst({ where: (m, { eq }) => eq(m.id, memberId) }),
    db
      .select({ id: item.id, priceCents: item.priceCents, replacementValueCents: item.replacementValueCents })
      .from(item)
      .where(eq(item.ownerId, memberId)),
    db
      .select({ startDate: booking.startDate, endDate: booking.endDate, returnedAt: booking.returnedAt })
      .from(booking)
      .where(and(eq(booking.borrowerId, memberId), eq(booking.status, "returned")))
      .orderBy(booking.returnedAt),
    // respondedAt is set on both approve and reject — only an approval
    // counts toward "Sauveur", so rejected requests (the one status that
    // can never have started as an approval, see respondToBooking) are
    // excluded.
    db
      .select({ createdAt: booking.createdAt, respondedAt: booking.respondedAt })
      .from(booking)
      .innerJoin(item, eq(item.id, booking.itemId))
      .where(and(eq(item.ownerId, memberId), isNotNull(booking.respondedAt), ne(booking.status, "rejected"))),
    db.select({ id: member.id }).from(member).where(eq(member.invitedById, memberId)),
    computeCollectiveWeekendMemberIds(),
    db
      .select({ pickedUpAt: booking.pickedUpAt })
      .from(booking)
      .where(and(eq(booking.borrowerId, memberId), isNotNull(booking.pickedUpAt))),
    db
      .select({ id: booking.id })
      .from(booking)
      .where(and(eq(booking.borrowerId, memberId), inArray(booking.status, ["active", "returned"]))),
  ]);

  const materialSharedValueCents = ownedItems.reduce(
    (sum, i) => sum + (i.priceCents ?? i.replacementValueCents ?? 0),
    0,
  );

  // Oldest-first from the query above; walk newest-first to find the current streak.
  const newestFirst = [...returnedAsBorrower].reverse();
  let consecutiveOnTimeReturns = 0;
  for (const r of newestFirst) {
    if (!r.returnedAt) break;
    const onTime = compare(fromTimestamp(r.returnedAt), r.endDate as CalendarDate) <= 0;
    if (!onTime) break;
    consecutiveOnTimeReturns += 1;
  }
  const cumulativeLateReturns = returnedAsBorrower.filter(
    (r) => r.returnedAt && compare(fromTimestamp(r.returnedAt), r.endDate as CalendarDate) > 0,
  ).length;

  const approvalMinutes = approvedOnOwnedItems
    .filter((b) => b.respondedAt)
    .map((b) => Math.round((b.respondedAt!.getTime() - b.createdAt.getTime()) / 60_000));
  const fastestApprovalMinutes = approvalMinutes.length > 0 ? Math.min(...approvalMinutes) : null;

  const hadLateNightPickup = pickupsAsBorrower.some((p) => {
    if (!p.pickedUpAt) return false;
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(
        p.pickedUpAt,
      ),
    );
    return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  });

  // One item's two queries (loan count, then issues) still run in sequence —
  // the second is only needed once the first clears the loan-count bar —
  // but different items now run in parallel with each other.
  const unbreakableChecks = await Promise.all(
    ownedItems.map(async (ownedItem) => {
      const loanCountRows = await db
        .select({ id: booking.id })
        .from(booking)
        .where(and(eq(booking.itemId, ownedItem.id), inArray(booking.status, ["active", "returned"])));
      if (loanCountRows.length < UNBREAKABLE_ITEM_MIN_LOANS) return false;
      const issueRows = await db
        .select({ id: maintenanceLog.id })
        .from(maintenanceLog)
        .where(and(eq(maintenanceLog.itemId, ownedItem.id), eq(maintenanceLog.kind, "issue")));
      return issueRows.length === 0;
    }),
  );
  const hasUnbreakableItem = unbreakableChecks.some(Boolean);

  const isPureLender = ownedItems.length > 0 && completedBorrowCountRows.length === 0;

  return {
    memberNumber: memberRow?.memberNumber ?? null,
    itemsListedCount: ownedItems.length,
    consecutiveOnTimeReturns,
    cumulativeLateReturns,
    fastestApprovalMinutes,
    materialSharedValueCents,
    referralCount: referralCountRows.length,
    hadCollectiveWeekend: collectiveWeekendMembers.has(memberId),
    hadLateNightPickup,
    hasUnbreakableItem,
    isPureLender,
    foundKonamiCode: memberRow?.foundKonamiCode ?? false,
    rolledNaturalTwenty: memberRow?.rolledNaturalTwenty ?? false,
    rolledNaturalOne: memberRow?.rolledNaturalOne ?? false,
  };
}

export interface GaugeDays {
  lentDays: number;
  borrowedDays: number;
}

function rangeDays(startDate: string, endDate: string): number {
  return diffDays(startDate as CalendarDate, endDate as CalendarDate) + 1;
}

/** Item-days actually lent/borrowed — only loans that really happened (active or returned), never pending/approved-but-not-picked-up. */
export async function computeGaugeDays(memberId: string): Promise<GaugeDays> {
  const [lentRows, borrowedRows] = await Promise.all([
    db
      .select({ startDate: booking.startDate, endDate: booking.endDate })
      .from(booking)
      .innerJoin(item, eq(item.id, booking.itemId))
      .where(and(eq(item.ownerId, memberId), inArray(booking.status, ["active", "returned"]))),
    db
      .select({ startDate: booking.startDate, endDate: booking.endDate })
      .from(booking)
      .where(and(eq(booking.borrowerId, memberId), inArray(booking.status, ["active", "returned"]))),
  ]);

  return {
    lentDays: lentRows.reduce((sum, r) => sum + rangeDays(r.startDate, r.endDate), 0),
    borrowedDays: borrowedRows.reduce((sum, r) => sum + rangeDays(r.startDate, r.endDate), 0),
  };
}

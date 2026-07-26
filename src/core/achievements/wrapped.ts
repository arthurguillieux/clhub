import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/core/db/client";
import { booking, item } from "@/core/db/schema";
import { diffDays, fromTimestamp, type CalendarDate } from "@/core/date";

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export interface WrappedData {
  year: number;
  mostCovetedItem: { name: string; slug: string; requestCount: number } | null;
  busiestMonth: { label: string; count: number } | null;
  topDuo: { ownerName: string; borrowerName: string; count: number } | null;
  totalItemDaysShared: number;
  totalSavingsCents: number;
}

async function memberDisplayName(memberId: string): Promise<string> {
  const memberRow = await db.query.member.findFirst({ where: (m, { eq: eqFn }) => eqFn(m.id, memberId) });
  if (!memberRow) return "Un membre";
  const userRow = await db.query.user.findFirst({ where: (u, { eq: eqFn }) => eqFn(u.id, memberRow.userId) });
  return userRow?.name ?? "Un membre";
}

/**
 * The annual retrospective (docs/01-produit.md §6) — "valeur d'usage nulle,
 * valeur d'attachement énorme." Computed for any year on demand rather than
 * only generated once in December, so it's meaningful mid-year too.
 */
export async function computeWrapped(year: number): Promise<WrappedData> {
  const yearStartInstant = new Date(Date.UTC(year, 0, 1));
  const yearEndInstant = new Date(Date.UTC(year + 1, 0, 1));
  const yearStartDate = `${year}-01-01` as CalendarDate;
  const nextYearStartDate = `${year + 1}-01-01` as CalendarDate;

  const requestsThisYear = await db
    .select({ itemId: booking.itemId, createdAt: booking.createdAt, itemName: item.name, itemSlug: item.slug })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(and(gte(booking.createdAt, yearStartInstant), lt(booking.createdAt, yearEndInstant)));

  const byItem = new Map<string, { name: string; slug: string; count: number }>();
  const byMonth = new Map<number, number>();
  for (const r of requestsThisYear) {
    const current = byItem.get(r.itemId) ?? { name: r.itemName, slug: r.itemSlug, count: 0 };
    current.count += 1;
    byItem.set(r.itemId, current);

    const monthIndex = Number(fromTimestamp(r.createdAt).slice(5, 7)) - 1;
    byMonth.set(monthIndex, (byMonth.get(monthIndex) ?? 0) + 1);
  }
  const mostCoveted = [...byItem.values()].sort((a, b) => b.count - a.count)[0];
  const busiestMonthEntry = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];

  const completedLoans = await db
    .select({
      startDate: booking.startDate,
      endDate: booking.endDate,
      priceCents: item.priceCents,
      replacementValueCents: item.replacementValueCents,
      ownerId: item.ownerId,
      borrowerId: booking.borrowerId,
    })
    .from(booking)
    .innerJoin(item, eq(item.id, booking.itemId))
    .where(
      and(
        inArray(booking.status, ["active", "returned"]),
        gte(booking.startDate, yearStartDate),
        lt(booking.startDate, nextYearStartDate),
      ),
    );

  const totalItemDaysShared = completedLoans.reduce(
    (sum, l) => sum + diffDays(l.startDate as CalendarDate, l.endDate as CalendarDate) + 1,
    0,
  );
  const totalSavingsCents = completedLoans.reduce(
    (sum, l) => sum + (l.priceCents ?? l.replacementValueCents ?? 0),
    0,
  );

  const byDuo = new Map<string, { ownerId: string; borrowerId: string; count: number }>();
  for (const l of completedLoans) {
    const key = `${l.ownerId}:${l.borrowerId}`;
    const current = byDuo.get(key) ?? { ownerId: l.ownerId, borrowerId: l.borrowerId, count: 0 };
    current.count += 1;
    byDuo.set(key, current);
  }
  const topDuoEntry = [...byDuo.values()].sort((a, b) => b.count - a.count)[0];

  let topDuo: WrappedData["topDuo"] = null;
  if (topDuoEntry) {
    const [ownerName, borrowerName] = await Promise.all([
      memberDisplayName(topDuoEntry.ownerId),
      memberDisplayName(topDuoEntry.borrowerId),
    ]);
    topDuo = { ownerName, borrowerName, count: topDuoEntry.count };
  }

  return {
    year,
    mostCovetedItem: mostCoveted
      ? { name: mostCoveted.name, slug: mostCoveted.slug, requestCount: mostCoveted.count }
      : null,
    busiestMonth: busiestMonthEntry
      ? { label: MONTH_NAMES[busiestMonthEntry[0]] ?? "?", count: busiestMonthEntry[1] }
      : null,
    topDuo,
    totalItemDaysShared,
    totalSavingsCents,
  };
}

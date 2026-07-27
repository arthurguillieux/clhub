import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, user } from "@/core/db/schema";
import { fetchBusyDays } from "@/core/ical/fetch";
import type { CalendarDate } from "@/core/date";

interface MemberAvailability {
  memberId: string;
  memberName: string;
  /** `null` = no calendar connected, or its feed couldn't be read — excluded from the free/busy count either way. */
  busyDays: Set<CalendarDate> | null;
}

export interface SharedAvailability {
  members: MemberAvailability[];
  /** Members whose calendar isn't counted (not connected, or the feed failed to load) — shown so the tally doesn't look more authoritative than it is. */
  uncountedCount: number;
}

/** Fetches every connected member's calendar in parallel — no caching (see docs/03-roadmap.md), correctness over speed for a handful of members. */
export async function computeSharedAvailability(
  windowStart: CalendarDate,
  windowEnd: CalendarDate,
): Promise<SharedAvailability> {
  const rows = await db
    .select({ id: member.id, name: user.name, personalCalendarUrl: member.personalCalendarUrl })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId));

  const members = await Promise.all(
    rows.map(async (row): Promise<MemberAvailability> => {
      if (!row.personalCalendarUrl) {
        return { memberId: row.id, memberName: row.name, busyDays: null };
      }
      const busyDays = await fetchBusyDays(row.personalCalendarUrl, windowStart, windowEnd);
      return { memberId: row.id, memberName: row.name, busyDays };
    }),
  );

  return {
    members,
    uncountedCount: members.filter((m) => m.busyDays === null).length,
  };
}

export interface DaySummary {
  day: CalendarDate;
  busyMemberNames: string[];
  freeCount: number;
  countedTotal: number;
}

export function summarizeByDay(
  availability: SharedAvailability,
  days: CalendarDate[],
): DaySummary[] {
  const counted = availability.members.filter((m): m is MemberAvailability & { busyDays: Set<CalendarDate> } =>
    m.busyDays !== null,
  );

  return days.map((day) => {
    const busy = counted.filter((m) => m.busyDays.has(day));
    return {
      day,
      busyMemberNames: busy.map((m) => m.memberName),
      freeCount: counted.length - busy.length,
      countedTotal: counted.length,
    };
  });
}

import { desc } from "drizzle-orm";
import { db } from "@/core/db/client";
import { changelogEntry } from "@/core/db/schema";
import type { CalendarDate } from "@/core/date";

export interface ChangelogDay {
  date: CalendarDate;
  entries: string[];
}

function groupByDay(rows: { entryDate: string; summary: string }[]): ChangelogDay[] {
  const byDate = new Map<string, string[]>();
  for (const row of rows) {
    const list = byDate.get(row.entryDate) ?? [];
    list.push(row.summary);
    byDate.set(row.entryDate, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, entries]) => ({ date: date as CalendarDate, entries }));
}

/** Every day with at least one entry, most recent first. */
export async function listChangelogDays(): Promise<ChangelogDay[]> {
  const rows = await db
    .select({ entryDate: changelogEntry.entryDate, summary: changelogEntry.summary })
    .from(changelogEntry)
    .orderBy(desc(changelogEntry.entryDate), desc(changelogEntry.createdAt));
  return groupByDay(rows);
}

export async function getLatestChangelogDay(): Promise<ChangelogDay | null> {
  const days = await listChangelogDays();
  return days[0] ?? null;
}

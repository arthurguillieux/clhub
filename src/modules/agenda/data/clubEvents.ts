import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/core/db/client";
import { clubEvent, member, user, type ClubEvent } from "@/core/db/schema";
import type { CalendarDate } from "@/core/date";

export interface CreateClubEventInput {
  title: string;
  eventDate: string;
  description: string | null;
}

export async function createClubEvent(createdById: string, input: CreateClubEventInput): Promise<ClubEvent> {
  const [created] = await db
    .insert(clubEvent)
    .values({ createdById, ...input })
    .returning();
  if (!created) throw new Error("Failed to create club event");
  return created;
}

export interface ClubEventWithAuthor extends ClubEvent {
  authorName: string;
}

/** Every event whose date falls in [start, end] — the visible month grid, generally. */
export async function listClubEventsInRange(
  start: CalendarDate,
  end: CalendarDate,
): Promise<ClubEventWithAuthor[]> {
  const rows = await db
    .select({ clubEvent, authorName: user.name })
    .from(clubEvent)
    .innerJoin(member, eq(member.id, clubEvent.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(gte(clubEvent.eventDate, start), lte(clubEvent.eventDate, end)))
    .orderBy(asc(clubEvent.eventDate));

  return rows.map((r) => ({ ...r.clubEvent, authorName: r.authorName }));
}

export async function getClubEventOwnerId(id: string): Promise<string | null> {
  const row = await db.query.clubEvent.findFirst({ where: (e, { eq: eqFn }) => eqFn(e.id, id) });
  return row?.createdById ?? null;
}

export async function getClubEventById(id: string): Promise<ClubEvent | null> {
  const row = await db.query.clubEvent.findFirst({ where: (e, { eq: eqFn }) => eqFn(e.id, id) });
  return row ?? null;
}

export interface UpdateClubEventInput {
  title: string;
  eventDate: string;
  description: string | null;
}

export async function updateClubEvent(id: string, input: UpdateClubEventInput): Promise<void> {
  await db.update(clubEvent).set(input).where(eq(clubEvent.id, id));
}

export async function deleteClubEvent(id: string): Promise<void> {
  await db.delete(clubEvent).where(eq(clubEvent.id, id));
}

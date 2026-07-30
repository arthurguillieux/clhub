import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, menuEvent, menuResponse, user, type MenuEvent } from "@/core/db/schema";

export interface CreateMenuEventInput {
  title: string;
  description: string | null;
  eventDate: string;
}

export async function createMenuEvent(
  createdById: string,
  input: CreateMenuEventInput,
): Promise<MenuEvent> {
  const [created] = await db
    .insert(menuEvent)
    .values({ createdById, title: input.title, description: input.description, eventDate: input.eventDate })
    .returning();
  if (!created) throw new Error("Failed to create menu event");
  return created;
}

export interface MenuEventSummary extends MenuEvent {
  creatorName: string;
  attendingCount: number;
  responseCount: number;
}

/** Upcoming first (soonest date first), then past events (most recent first). */
export async function listMenuEvents(): Promise<MenuEventSummary[]> {
  const events = await db
    .select({ menuEvent, creatorName: user.name })
    .from(menuEvent)
    .innerJoin(member, eq(member.id, menuEvent.createdById))
    .innerJoin(user, eq(user.id, member.userId));
  if (events.length === 0) return [];

  const responses = await db.select().from(menuResponse);
  const statsByEvent = new Map<string, { attending: number; total: number }>();
  for (const r of responses) {
    const current = statsByEvent.get(r.eventId) ?? { attending: 0, total: 0 };
    current.total += 1;
    if (r.attending) current.attending += 1;
    statsByEvent.set(r.eventId, current);
  }

  const today = new Date().toISOString().slice(0, 10);
  return events
    .map((row) => {
      const stats = statsByEvent.get(row.menuEvent.id) ?? { attending: 0, total: 0 };
      return {
        ...row.menuEvent,
        creatorName: row.creatorName,
        attendingCount: stats.attending,
        responseCount: stats.total,
      };
    })
    .sort((a, b) => {
      const aUpcoming = a.eventDate >= today;
      const bUpcoming = b.eventDate >= today;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? a.eventDate.localeCompare(b.eventDate) : b.eventDate.localeCompare(a.eventDate);
    });
}

export interface MenuResponseWithMember {
  memberId: string;
  memberName: string;
  attending: boolean;
  bringing: string | null;
  allergies: string | null;
  dietaryTags: unknown;
  dietaryNotes: string | null;
}

export interface MenuEventDetail extends MenuEvent {
  creatorName: string;
  responses: MenuResponseWithMember[];
}

export async function getMenuEventDetail(eventId: string): Promise<MenuEventDetail | null> {
  const row = await db.query.menuEvent.findFirst({ where: (e, { eq: eqFn }) => eqFn(e.id, eventId) });
  if (!row) return null;

  const creatorMember = await db.query.member.findFirst({
    where: (m, { eq: eqFn }) => eqFn(m.id, row.createdById),
  });
  const creatorUser = creatorMember
    ? await db.query.user.findFirst({ where: (u, { eq: eqFn }) => eqFn(u.id, creatorMember.userId) })
    : null;

  const responseRows = await db
    .select({
      menuResponse,
      memberName: user.name,
      dietaryTags: member.dietaryTags,
      dietaryNotes: member.dietaryNotes,
    })
    .from(menuResponse)
    .innerJoin(member, eq(member.id, menuResponse.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(menuResponse.eventId, eventId))
    .orderBy(desc(menuResponse.updatedAt));

  return {
    ...row,
    creatorName: creatorUser?.name ?? "Un membre",
    responses: responseRows.map((r) => ({
      memberId: r.menuResponse.memberId,
      memberName: r.memberName,
      attending: r.menuResponse.attending,
      bringing: r.menuResponse.bringing,
      allergies: r.menuResponse.allergies,
      dietaryTags: r.dietaryTags,
      dietaryNotes: r.dietaryNotes,
    })),
  };
}

export async function getMyResponse(eventId: string, memberId: string) {
  return db.query.menuResponse.findFirst({
    where: (r, { and: andFn, eq: eqFn }) => andFn(eqFn(r.eventId, eventId), eqFn(r.memberId, memberId)),
  });
}

export interface SubmitResponseInput {
  attending: boolean;
  bringing: string | null;
  allergies: string | null;
}

export async function submitResponse(
  eventId: string,
  memberId: string,
  input: SubmitResponseInput,
): Promise<void> {
  await db
    .insert(menuResponse)
    .values({ eventId, memberId, ...input })
    .onConflictDoUpdate({
      target: [menuResponse.eventId, menuResponse.memberId],
      set: { ...input, updatedAt: new Date() },
    });
}

export async function getMenuEventOwnerId(eventId: string): Promise<string | null> {
  const row = await db.query.menuEvent.findFirst({ where: (e, { eq: eqFn }) => eqFn(e.id, eventId) });
  return row?.createdById ?? null;
}

export interface UpdateMenuEventInput {
  title: string;
  description: string | null;
  eventDate: string;
}

export async function updateMenuEvent(eventId: string, input: UpdateMenuEventInput): Promise<void> {
  await db.update(menuEvent).set(input).where(eq(menuEvent.id, eventId));
}

/** No cascade on menu_response.event_id — clear responses before the event itself. */
export async function deleteMenuEvent(eventId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(menuResponse).where(eq(menuResponse.eventId, eventId));
    await tx.delete(menuEvent).where(eq(menuEvent.id, eventId));
  });
}

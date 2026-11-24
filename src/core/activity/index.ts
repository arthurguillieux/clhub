import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { activity, member, user, type ActivityEntry } from "@/core/db/schema";

export async function logActivity(entry: {
  section: string;
  kind: string;
  actorId: string;
  subjectRef?: string;
  payload?: Record<string, unknown>;
}): Promise<ActivityEntry> {
  const [row] = await db
    .insert(activity)
    .values({
      section: entry.section,
      kind: entry.kind,
      actorId: entry.actorId,
      subjectRef: entry.subjectRef ?? null,
      payload: entry.payload ?? {},
    })
    .returning();

  if (!row) {
    throw new Error("Failed to log activity entry");
  }
  return row;
}

export async function listRecentActivity(limit = 20): Promise<ActivityEntry[]> {
  return db.select().from(activity).orderBy(desc(activity.createdAt)).limit(limit);
}

export type ActivityWithActor = ActivityEntry & { actorName: string | null; actorImage: string | null };

/** The club's feed with who did it: their name and picture, for the home page's « Dans le club ». */
export async function listRecentActivityWithActors(limit = 20): Promise<ActivityWithActor[]> {
  const rows = await db
    .select({ entry: activity, actorName: user.name, actorImage: user.image })
    .from(activity)
    .leftJoin(member, eq(member.id, activity.actorId))
    .leftJoin(user, eq(user.id, member.userId))
    .orderBy(desc(activity.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.entry, actorName: r.actorName, actorImage: r.actorImage }));
}

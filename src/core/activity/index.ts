import { desc } from "drizzle-orm";
import { db } from "@/core/db/client";
import { activity, type ActivityEntry } from "@/core/db/schema";

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

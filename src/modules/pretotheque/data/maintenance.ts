import { asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { item, maintenanceLog, member, user, type MaintenanceLog } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { logActivity } from "@/core/activity";

export interface MaintenanceLogWithAuthor extends MaintenanceLog {
  authorName: string;
}

/** Oldest first — a chronological history of what happened to the item. */
export async function listMaintenanceLogForItem(
  itemId: string,
): Promise<MaintenanceLogWithAuthor[]> {
  const rows = await db
    .select({ maintenanceLog, authorName: user.name })
    .from(maintenanceLog)
    .innerJoin(member, eq(member.id, maintenanceLog.authorId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(maintenanceLog.itemId, itemId))
    .orderBy(asc(maintenanceLog.createdAt));

  return rows.map((r) => ({ ...r.maintenanceLog, authorName: r.authorName }));
}

export type ReportIssueResult =
  | { ok: true }
  | { ok: false; reason: "item-not-found" };

/** Any member can flag a problem — it flips the item to 'broken' so no one else books it blind. */
export async function reportIssue(
  itemId: string,
  reporterId: string,
  note: string,
): Promise<ReportIssueResult> {
  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, itemId) });
  if (!targetItem) return { ok: false, reason: "item-not-found" };

  await db.insert(maintenanceLog).values({ itemId, authorId: reporterId, kind: "issue", note });
  await db.update(item).set({ status: "broken", updatedAt: new Date() }).where(eq(item.id, itemId));

  await logActivity({
    section: "pretotheque",
    kind: "item.issue-reported",
    actorId: reporterId,
    subjectRef: `item:${itemId}`,
    payload: { itemName: targetItem.name },
  });
  await createNotification({
    memberId: targetItem.ownerId,
    kind: "item.issue-reported",
    entityRef: `item:${itemId}`,
    payload: { itemName: targetItem.name, note },
  });

  return { ok: true };
}

export type ResolveMaintenanceResult =
  | { ok: true }
  | { ok: false; reason: "item-not-found" }
  | { ok: false; reason: "forbidden" };

/** Only the owner — or an admin standing in for them — can declare an item fixed again. */
export async function resolveMaintenance(
  itemId: string,
  actorId: string,
  note: string,
  isAdmin: boolean = false,
): Promise<ResolveMaintenanceResult> {
  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, itemId) });
  if (!targetItem) return { ok: false, reason: "item-not-found" };
  if (!isAdmin && targetItem.ownerId !== actorId) return { ok: false, reason: "forbidden" };

  await db
    .insert(maintenanceLog)
    .values({ itemId, authorId: actorId, kind: "maintenance", note });
  await db.update(item).set({ status: "available", updatedAt: new Date() }).where(eq(item.id, itemId));

  await logActivity({
    section: "pretotheque",
    kind: "item.repaired",
    actorId,
    subjectRef: `item:${itemId}`,
    payload: { itemName: targetItem.name },
  });

  return { ok: true };
}

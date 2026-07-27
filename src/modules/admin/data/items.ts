import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import {
  item,
  itemUnit,
  itemPhoto,
  itemComment,
  maintenanceLog,
  waitlistEntry,
  booking,
  user,
  member,
  type Item,
} from "@/core/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AdminItemRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
}

export async function listAllItemsForAdmin(): Promise<AdminItemRow[]> {
  const rows = await db
    .select({ item, ownerName: user.name })
    .from(item)
    .innerJoin(member, eq(member.id, item.ownerId))
    .innerJoin(user, eq(user.id, member.userId))
    .orderBy(desc(item.createdAt));

  return rows.map((r) => ({
    id: r.item.id,
    name: r.item.name,
    slug: r.item.slug,
    category: r.item.category,
    ownerId: r.item.ownerId,
    ownerName: r.ownerName,
    createdAt: r.item.createdAt,
  }));
}

export async function reassignItemOwner(itemId: string, newOwnerId: string): Promise<void> {
  await db.update(item).set({ ownerId: newOwnerId, updatedAt: new Date() }).where(eq(item.id, itemId));
}

/**
 * Deletes an item and every row that points back to it — units, photos,
 * comments, maintenance history, waitlist entries, and any booking (past or
 * present) made against it. Runs inside the caller's transaction when one
 * is supplied (member deletion cascades through here for owned items),
 * otherwise opens its own.
 */
export async function deleteItemDependents(tx: Tx, itemId: string): Promise<void> {
  await tx.delete(booking).where(eq(booking.itemId, itemId));
  await tx.delete(waitlistEntry).where(eq(waitlistEntry.itemId, itemId));
  await tx.delete(itemComment).where(eq(itemComment.itemId, itemId));
  await tx.delete(maintenanceLog).where(eq(maintenanceLog.itemId, itemId));
  await tx.delete(itemPhoto).where(eq(itemPhoto.itemId, itemId));
  await tx.delete(itemUnit).where(eq(itemUnit.itemId, itemId));
  await tx.delete(item).where(eq(item.id, itemId));
}

export async function deleteItemCascade(itemId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deleteItemDependents(tx, itemId);
  });
}

export async function deleteItemsOwnedByMember(tx: Tx, ownerId: string): Promise<void> {
  const owned = await tx.select({ id: item.id }).from(item).where(eq(item.ownerId, ownerId));
  if (owned.length === 0) return;
  const ids = owned.map((o) => o.id);
  await tx.delete(booking).where(inArray(booking.itemId, ids));
  await tx.delete(waitlistEntry).where(inArray(waitlistEntry.itemId, ids));
  await tx.delete(itemComment).where(inArray(itemComment.itemId, ids));
  await tx.delete(maintenanceLog).where(inArray(maintenanceLog.itemId, ids));
  await tx.delete(itemPhoto).where(inArray(itemPhoto.itemId, ids));
  await tx.delete(itemUnit).where(inArray(itemUnit.itemId, ids));
  await tx.delete(item).where(inArray(item.id, ids));
}

export type { Item };

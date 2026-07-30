import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/core/db/client";
import { itemUnit, type ItemUnit } from "@/core/db/schema";

async function requireOwnedItem(itemId: string, requesterId: string, isAdmin: boolean = false) {
  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, itemId) });
  if (!targetItem) return { ok: false as const, reason: "not-found" as const };
  if (!isAdmin && targetItem.ownerId !== requesterId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, item: targetItem };
}

export type UnitResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; reason: "not-found" | "forbidden" | "last-active-unit" };

/** Active units only, in creation order — what the availability engine and the booking calendar use. */
export async function listActiveUnitsForItem(itemId: string): Promise<ItemUnit[]> {
  return db
    .select()
    .from(itemUnit)
    .where(and(eq(itemUnit.itemId, itemId), isNull(itemUnit.archivedAt)))
    .orderBy(asc(itemUnit.createdAt));
}

/** Active and archived, for the owner's management view. */
export async function listAllUnitsForItem(itemId: string): Promise<ItemUnit[]> {
  return db.select().from(itemUnit).where(eq(itemUnit.itemId, itemId)).orderBy(asc(itemUnit.createdAt));
}

/** Every new item gets exactly one unit — see drizzle/0013_*.sql for the equivalent one-time backfill. */
export async function createDefaultUnit(itemId: string): Promise<ItemUnit> {
  const [created] = await db.insert(itemUnit).values({ itemId }).returning();
  if (!created) throw new Error("Failed to create default item unit");
  return created;
}

export async function addItemUnit(
  itemId: string,
  requesterId: string,
  label: string | null,
  isAdmin: boolean = false,
): Promise<UnitResult<ItemUnit>> {
  const check = await requireOwnedItem(itemId, requesterId, isAdmin);
  if (!check.ok) return check;

  const [created] = await db.insert(itemUnit).values({ itemId, label }).returning();
  if (!created) throw new Error("Failed to create item unit");
  return { ok: true, data: created };
}

export async function renameItemUnit(
  itemId: string,
  requesterId: string,
  unitId: string,
  label: string | null,
  isAdmin: boolean = false,
): Promise<UnitResult> {
  const check = await requireOwnedItem(itemId, requesterId, isAdmin);
  if (!check.ok) return check;

  await db.update(itemUnit).set({ label }).where(and(eq(itemUnit.id, unitId), eq(itemUnit.itemId, itemId)));
  return { ok: true };
}

/**
 * Retires a unit so it stops counting toward availability — but never the
 * last active one, which would make the item silently unbookable instead of
 * the owner making that call explicitly via `item.status`.
 */
export async function archiveItemUnit(
  itemId: string,
  requesterId: string,
  unitId: string,
  isAdmin: boolean = false,
): Promise<UnitResult> {
  const check = await requireOwnedItem(itemId, requesterId, isAdmin);
  if (!check.ok) return check;

  const activeUnits = await listActiveUnitsForItem(itemId);
  const isActive = activeUnits.some((u) => u.id === unitId);
  if (isActive && activeUnits.length <= 1) {
    return { ok: false, reason: "last-active-unit" };
  }

  await db
    .update(itemUnit)
    .set({ archivedAt: new Date() })
    .where(and(eq(itemUnit.id, unitId), eq(itemUnit.itemId, itemId)));
  return { ok: true };
}

export async function unarchiveItemUnit(
  itemId: string,
  requesterId: string,
  unitId: string,
  isAdmin: boolean = false,
): Promise<UnitResult> {
  const check = await requireOwnedItem(itemId, requesterId, isAdmin);
  if (!check.ok) return check;

  await db
    .update(itemUnit)
    .set({ archivedAt: null })
    .where(and(eq(itemUnit.id, unitId), eq(itemUnit.itemId, itemId)));
  return { ok: true };
}

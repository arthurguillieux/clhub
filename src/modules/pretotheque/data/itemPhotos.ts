import { and, asc, eq, max, ne } from "drizzle-orm";
import { db } from "@/core/db/client";
import { item, itemPhoto, type ItemPhoto } from "@/core/db/schema";
import { saveItemGalleryPhoto, type SavedItemPhoto } from "@/core/storage/itemPhoto";

export async function listItemPhotos(itemId: string): Promise<ItemPhoto[]> {
  return db.select().from(itemPhoto).where(eq(itemPhoto.itemId, itemId)).orderBy(asc(itemPhoto.sort));
}

async function syncCoverPhoto(itemId: string): Promise<void> {
  const primary = await db.query.itemPhoto.findFirst({
    where: (p, { and, eq }) => and(eq(p.itemId, itemId), eq(p.isPrimary, true)),
  });
  await db
    .update(item)
    .set({ photoPath: primary?.path ?? null, updatedAt: new Date() })
    .where(eq(item.id, itemId));
}

export type GalleryResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; reason: "not-found" | "forbidden" };

async function requireOwnedItem(itemId: string, requesterId: string) {
  const targetItem = await db.query.item.findFirst({ where: (i, { eq }) => eq(i.id, itemId) });
  if (!targetItem) return { ok: false as const, reason: "not-found" as const };
  if (targetItem.ownerId !== requesterId) return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, item: targetItem };
}

/** Saves and inserts each upload, appended after any existing photos; the very first photo ever added becomes primary. */
export async function addItemPhotos(
  itemId: string,
  requesterId: string,
  fileBuffers: Buffer[],
): Promise<GalleryResult<ItemPhoto[]>> {
  const check = await requireOwnedItem(itemId, requesterId);
  if (!check.ok) return check;
  if (fileBuffers.length === 0) return { ok: true, data: [] };

  const maxRows = await db
    .select({ value: max(itemPhoto.sort) })
    .from(itemPhoto)
    .where(eq(itemPhoto.itemId, itemId));
  const currentMax = maxRows[0]?.value ?? null;
  const hasExisting = currentMax !== null;

  const saved: SavedItemPhoto[] = await Promise.all(
    fileBuffers.map((buffer) => saveItemGalleryPhoto(itemId, buffer)),
  );

  const inserted = await db
    .insert(itemPhoto)
    .values(
      saved.map((photo, index) => ({
        itemId,
        path: photo.path,
        width: photo.width,
        height: photo.height,
        sort: (currentMax ?? -1) + 1 + index,
        isPrimary: !hasExisting && index === 0,
      })),
    )
    .returning();

  if (!hasExisting) {
    await syncCoverPhoto(itemId);
  }
  return { ok: true, data: inserted };
}

export async function setPrimaryItemPhoto(
  itemId: string,
  requesterId: string,
  photoId: string,
): Promise<GalleryResult> {
  const check = await requireOwnedItem(itemId, requesterId);
  if (!check.ok) return check;

  await db
    .update(itemPhoto)
    .set({ isPrimary: false })
    .where(and(eq(itemPhoto.itemId, itemId), ne(itemPhoto.id, photoId)));
  await db.update(itemPhoto).set({ isPrimary: true }).where(eq(itemPhoto.id, photoId));
  await syncCoverPhoto(itemId);
  return { ok: true };
}

export async function deleteItemPhoto(
  itemId: string,
  requesterId: string,
  photoId: string,
): Promise<GalleryResult> {
  const check = await requireOwnedItem(itemId, requesterId);
  if (!check.ok) return check;

  const existing = await db.query.itemPhoto.findFirst({ where: (p, { eq }) => eq(p.id, photoId) });
  if (!existing) return { ok: true };

  await db.delete(itemPhoto).where(eq(itemPhoto.id, photoId));

  if (existing.isPrimary) {
    const next = await db.query.itemPhoto.findFirst({
      where: (p, { eq }) => eq(p.itemId, existing.itemId),
      orderBy: (p, { asc }) => asc(p.sort),
    });
    if (next) {
      await db.update(itemPhoto).set({ isPrimary: true }).where(eq(itemPhoto.id, next.id));
    }
    await syncCoverPhoto(existing.itemId);
  }
  return { ok: true };
}

/** Moves one photo up or down in sort order by swapping with its neighbor. */
export async function moveItemPhoto(
  itemId: string,
  requesterId: string,
  photoId: string,
  direction: "up" | "down",
): Promise<GalleryResult> {
  const check = await requireOwnedItem(itemId, requesterId);
  if (!check.ok) return check;

  const photos = await listItemPhotos(itemId);
  const index = photos.findIndex((p) => p.id === photoId);
  if (index === -1) return { ok: true };

  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = photos[neighborIndex];
  const current = photos[index];
  if (!neighbor || !current) return { ok: true };

  await db.update(itemPhoto).set({ sort: neighbor.sort }).where(eq(itemPhoto.id, current.id));
  await db.update(itemPhoto).set({ sort: current.sort }).where(eq(itemPhoto.id, neighbor.id));
  return { ok: true };
}

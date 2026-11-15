import sharp from "sharp";
import { and, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { letter, letterGift, letterImage } from "@/core/db/schema";

/**
 * A photo from a phone or from a shop's page, made fit to show: upright, 1200 px at most, webp, and
 * stripped of its metadata (a phone writes where the picture was taken). Null if it isn't a picture.
 */
export async function prepareImage(input: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(input, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function storeImage(letterId: string, input: Buffer): Promise<string | null> {
  const data = await prepareImage(input);
  if (!data) return null;
  const [row] = await db.insert(letterImage).values({ letterId, data }).returning({ id: letterImage.id });
  return row?.id ?? null;
}

export async function deleteImage(id: string | null): Promise<void> {
  if (id) await db.delete(letterImage).where(eq(letterImage.id, id));
}

/** Whether a picture belongs to this letter: a gift may only take one of its own. */
export async function imageBelongs(id: string, letterId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: letterImage.id })
    .from(letterImage)
    .where(and(eq(letterImage.id, id), eq(letterImage.letterId, letterId)))
    .limit(1);
  return !!row;
}

export async function copyImage(id: string | null, toLetterId: string): Promise<string | null> {
  if (!id) return null;
  const [row] = await db.select({ data: letterImage.data }).from(letterImage).where(eq(letterImage.id, id)).limit(1);
  if (!row) return null;
  const [copy] = await db.insert(letterImage).values({ letterId: toLetterId, data: row.data }).returning({ id: letterImage.id });
  return copy?.id ?? null;
}

/** A picture of a letter, for whoever has its family link (the organizers' page goes through it too). */
export async function readImage(token: string, id: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ data: letterImage.data })
    .from(letterImage)
    .innerJoin(letter, eq(letter.id, letterImage.letterId))
    .where(and(eq(letter.token, token), eq(letterImage.id, id)))
    .limit(1);
  return row?.data ?? null;
}

/**
 * Pictures fetched for a gift that was never saved (a link tried, then dropped): gone after an hour.
 * Anything the letter or one of its gifts shows is kept.
 */
export async function deleteOrphanImages(letterId: string): Promise<void> {
  const [own] = await db.select({ photoId: letter.photoId, thanksPhotoId: letter.thanksPhotoId }).from(letter).where(eq(letter.id, letterId)).limit(1);
  const giftPhotos = await db.select({ photoId: letterGift.photoId }).from(letterGift).where(eq(letterGift.letterId, letterId));
  const keep = [own?.photoId, own?.thanksPhotoId, ...giftPhotos.map((g) => g.photoId)].filter((id): id is string => !!id);
  await db
    .delete(letterImage)
    .where(
      and(
        eq(letterImage.letterId, letterId),
        lt(letterImage.createdAt, sql`now() - interval '1 hour'`),
        keep.length > 0 ? notInArray(letterImage.id, keep) : undefined,
      ),
    );
}

export const imageUrl = (token: string, id: string | null) => (id ? `/api/lettre/${token}/image/${id}` : null);

/** For the tests and the duplicate: how many pictures a letter holds. */
export async function countImages(letterIds: string[]): Promise<number> {
  if (letterIds.length === 0) return 0;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(letterImage).where(inArray(letterImage.letterId, letterIds));
  return row?.n ?? 0;
}

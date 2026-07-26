import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { item, itemUnit, member, user, type Item } from "@/core/db/schema";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(COMBINING_DIACRITICS, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "objet"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Small, bounded table — a loop is simpler and clearer than a clever query.
  while (await db.query.item.findFirst({ where: (i, { eq }) => eq(i.slug, candidate) })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export interface ItemInput {
  name: string;
  description: string | null;
  category: string;
  brand: string | null;
  model: string | null;
  productUrl: string | null;
  priceCents: number | null;
  replacementValueCents: number | null;
  condition: string;
  accessories: string | null;
  consumables: string | null;
  safetyNotes: string | null;
  pickupLocation: string | null;
  pickupNotes: string | null;
  autoApprove: boolean;
  maxLoanDays: number | null;
  bufferDays: number;
}

/** Every item starts with exactly one unit (ADR-004) — owners add more from the item page if they have several copies. */
export async function createItem(ownerId: string, input: ItemInput): Promise<Item> {
  const slug = await uniqueSlug(slugify(input.name));
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(item)
      .values({ ...input, ownerId, slug })
      .returning();
    if (!created) {
      throw new Error("Failed to create item");
    }
    await tx.insert(itemUnit).values({ itemId: created.id });
    return created;
  });
}

export async function setItemPhoto(itemId: string, photoPath: string): Promise<void> {
  await db.update(item).set({ photoPath, updatedAt: new Date() }).where(eq(item.id, itemId));
}

export async function getItemBySlug(slug: string): Promise<Item | undefined> {
  return db.query.item.findFirst({ where: (i, { eq }) => eq(i.slug, slug) });
}

export interface ItemWithOwner extends Item {
  ownerName: string;
}

function withOwnerName() {
  return db
    .select({ item, ownerName: user.name })
    .from(item)
    .innerJoin(member, eq(member.id, item.ownerId))
    .innerJoin(user, eq(user.id, member.userId));
}

export async function getItemWithOwnerBySlug(slug: string): Promise<ItemWithOwner | undefined> {
  const [row] = await withOwnerName().where(eq(item.slug, slug)).limit(1);
  return row ? { ...row.item, ownerName: row.ownerName } : undefined;
}

export async function listItems(filters?: {
  category?: string;
  ownerId?: string;
  status?: string;
}): Promise<ItemWithOwner[]> {
  const conditions = [];
  if (filters?.category) conditions.push(eq(item.category, filters.category));
  if (filters?.ownerId) conditions.push(eq(item.ownerId, filters.ownerId));
  if (filters?.status) conditions.push(eq(item.status, filters.status));

  const rows = await withOwnerName()
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(item.createdAt));

  return rows.map((row) => ({ ...row.item, ownerName: row.ownerName }));
}

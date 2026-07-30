import { asc, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { donCategory, type DonCategory } from "@/core/db/schema";

export async function listDonCategories(): Promise<DonCategory[]> {
  return db.select().from(donCategory).orderBy(asc(donCategory.sort), asc(donCategory.name));
}

/** Admin-only at the action layer (see admin/dons/actions.ts) — this just writes. */
export async function createDonCategory(name: string): Promise<DonCategory> {
  const maxRow = await db.select().from(donCategory).orderBy(asc(donCategory.sort));
  const nextSort = maxRow.length > 0 ? Math.max(...maxRow.map((r) => r.sort)) + 10 : 0;

  const [created] = await db.insert(donCategory).values({ name, sort: nextSort }).returning();
  if (!created) throw new Error("Failed to create category");
  return created;
}

export async function getDonCategory(id: string): Promise<DonCategory | null> {
  const row = await db.query.donCategory.findFirst({ where: (c, { eq: eqFn }) => eqFn(c.id, id) });
  return row ?? null;
}

export async function deleteDonCategory(id: string): Promise<void> {
  await db.delete(donCategory).where(eq(donCategory.id, id));
}

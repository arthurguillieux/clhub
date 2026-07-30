import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/core/db/client";
import { donListing, donInterest, donCategory, member, user, type DonListing } from "@/core/db/schema";

export interface CreateListingInput {
  categoryId: string;
  title: string;
  description: string | null;
  priceText: string | null;
  isFree: boolean;
  photoPath: string | null;
}

export async function createListing(createdById: string, input: CreateListingInput): Promise<DonListing> {
  const [created] = await db.insert(donListing).values({ createdById, ...input }).returning();
  if (!created) throw new Error("Failed to create listing");
  return created;
}

export interface ListingSummary extends DonListing {
  authorName: string;
  categoryName: string;
  interestCount: number;
}

/** Excludes completed listings — those are done, not browseable. Still reachable by direct link. */
export async function listListings(categoryId?: string): Promise<ListingSummary[]> {
  const rows = await db
    .select({ donListing, authorName: user.name, categoryName: donCategory.name })
    .from(donListing)
    .innerJoin(member, eq(member.id, donListing.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(donCategory, eq(donCategory.id, donListing.categoryId))
    .where(
      categoryId
        ? and(ne(donListing.status, "completed"), eq(donListing.categoryId, categoryId))
        : ne(donListing.status, "completed"),
    )
    .orderBy(desc(donListing.createdAt));
  if (rows.length === 0) return [];

  const interests = await db.select({ listingId: donInterest.listingId }).from(donInterest);
  const countByListing = new Map<string, number>();
  for (const i of interests) {
    countByListing.set(i.listingId, (countByListing.get(i.listingId) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r.donListing,
    authorName: r.authorName,
    categoryName: r.categoryName,
    interestCount: countByListing.get(r.donListing.id) ?? 0,
  }));
}

export interface InterestWithMember {
  memberId: string;
  memberName: string;
  createdAt: Date;
}

export interface ListingDetail extends DonListing {
  authorName: string;
  categoryName: string;
  reservedForName: string | null;
  interests: InterestWithMember[];
}

export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const row = await db
    .select({ donListing, authorName: user.name, categoryName: donCategory.name })
    .from(donListing)
    .innerJoin(member, eq(member.id, donListing.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .innerJoin(donCategory, eq(donCategory.id, donListing.categoryId))
    .where(eq(donListing.id, id))
    .limit(1);

  const first = row[0];
  if (!first) return null;

  const [interestRows, reservedForRows] = await Promise.all([
    db
      .select({ memberId: donInterest.memberId, memberName: user.name, createdAt: donInterest.createdAt })
      .from(donInterest)
      .innerJoin(member, eq(member.id, donInterest.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(donInterest.listingId, id))
      .orderBy(asc(donInterest.createdAt)),
    first.donListing.reservedForMemberId
      ? db
          .select({ name: user.name })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(eq(member.id, first.donListing.reservedForMemberId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...first.donListing,
    authorName: first.authorName,
    categoryName: first.categoryName,
    reservedForName: reservedForRows[0]?.name ?? null,
    interests: interestRows,
  };
}

export async function getListingById(id: string): Promise<DonListing | null> {
  const row = await db.query.donListing.findFirst({ where: (l, { eq: eqFn }) => eqFn(l.id, id) });
  return row ?? null;
}

export interface UpdateListingInput {
  categoryId: string;
  title: string;
  description: string | null;
  priceText: string | null;
  isFree: boolean;
}

export async function updateListing(id: string, input: UpdateListingInput): Promise<void> {
  await db.update(donListing).set({ ...input, updatedAt: new Date() }).where(eq(donListing.id, id));
}

export async function setListingPhoto(id: string, photoPath: string): Promise<void> {
  await db.update(donListing).set({ photoPath, updatedAt: new Date() }).where(eq(donListing.id, id));
}

export async function deleteListing(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(donInterest).where(eq(donInterest.listingId, id));
    await tx.delete(donListing).where(eq(donListing.id, id));
  });
}

export async function expressInterest(listingId: string, memberId: string): Promise<void> {
  await db.insert(donInterest).values({ listingId, memberId }).onConflictDoNothing();
}

export async function withdrawInterest(listingId: string, memberId: string): Promise<void> {
  await db.delete(donInterest).where(and(eq(donInterest.listingId, listingId), eq(donInterest.memberId, memberId)));
}

export async function chooseInterest(listingId: string, memberId: string): Promise<void> {
  await db
    .update(donListing)
    .set({ status: "reserved", reservedForMemberId: memberId, updatedAt: new Date() })
    .where(eq(donListing.id, listingId));
}

export async function cancelReservation(listingId: string): Promise<void> {
  await db
    .update(donListing)
    .set({ status: "available", reservedForMemberId: null, updatedAt: new Date() })
    .where(eq(donListing.id, listingId));
}

export async function markCompleted(listingId: string): Promise<void> {
  await db.update(donListing).set({ status: "completed", updatedAt: new Date() }).where(eq(donListing.id, listingId));
}

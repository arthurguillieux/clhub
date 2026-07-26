/**
 * Integration test — needs a live Postgres with migrations applied (DATABASE_URL).
 * Proves the guarantee the whole architecture rests on: the exclusion constraint,
 * not application code, is what makes double-booking a single *unit* impossible.
 * See docs/02-architecture.md §3.3, ADR-004 and ADR-006.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/core/db/client";
import { booking, item, itemUnit, member, user } from "@/core/db/schema";

describe("booking exclusion constraint", () => {
  let userId: string;
  let memberId: string;
  let itemId: string;
  let unitAId: string;
  let unitBId: string;

  beforeAll(async () => {
    userId = randomUUID();
    await db
      .insert(user)
      .values({ id: userId, email: `test-${userId}@example.com`, name: "Test Owner", emailVerified: true });

    const [createdMember] = await db.insert(member).values({ userId }).returning();
    memberId = createdMember!.id;

    const [createdItem] = await db
      .insert(item)
      .values({ slug: `test-item-${userId}`, ownerId: memberId, name: "Test Item", category: "bricolage" })
      .returning();
    itemId = createdItem!.id;

    const [unitA] = await db.insert(itemUnit).values({ itemId }).returning();
    const [unitB] = await db.insert(itemUnit).values({ itemId }).returning();
    unitAId = unitA!.id;
    unitBId = unitB!.id;
  });

  afterAll(async () => {
    await db.delete(booking).where(eq(booking.itemId, itemId));
    await db.delete(itemUnit).where(eq(itemUnit.itemId, itemId));
    await db.delete(item).where(eq(item.id, itemId));
    await db.delete(member).where(eq(member.id, memberId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("rejects an overlapping approved booking on the same unit, but allows pending overlaps and adjacent bookings", async () => {
    await db.insert(booking).values({
      itemId,
      unitId: unitAId,
      borrowerId: memberId,
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      status: "approved",
    });

    await expect(
      db.insert(booking).values({
        itemId,
        unitId: unitAId,
        borrowerId: memberId,
        startDate: "2026-08-03",
        endDate: "2026-08-10",
        status: "approved",
      }),
    ).rejects.toThrow();

    // A pending request for the very same dates is fine — it never blocks (ADR-006).
    await expect(
      db.insert(booking).values({
        itemId,
        unitId: unitAId,
        borrowerId: memberId,
        startDate: "2026-08-03",
        endDate: "2026-08-10",
        status: "pending",
      }),
    ).resolves.toBeDefined();

    // Starts the day after the first approved booking ends — no overlap, must succeed.
    await expect(
      db.insert(booking).values({
        itemId,
        unitId: unitAId,
        borrowerId: memberId,
        startDate: "2026-08-06",
        endDate: "2026-08-10",
        status: "approved",
      }),
    ).resolves.toBeDefined();
  });

  it("allows the same dates on a different unit of the same item (ADR-004)", async () => {
    // unitA is already approved for 2026-08-01..08-05 (previous test) — a second
    // trestle of the same item must be independently bookable for those same days.
    await expect(
      db.insert(booking).values({
        itemId,
        unitId: unitBId,
        borrowerId: memberId,
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        status: "approved",
      }),
    ).resolves.toBeDefined();
  });

  it("under real concurrency, exactly one of two overlapping approved inserts succeeds on the same unit", async () => {
    const attempt = (startDate: string, endDate: string) =>
      db
        .insert(booking)
        .values({ itemId, unitId: unitAId, borrowerId: memberId, startDate, endDate, status: "approved" })
        .then(() => "ok" as const)
        .catch(() => "failed" as const);

    const results = await Promise.all([
      attempt("2026-09-01", "2026-09-05"),
      attempt("2026-09-03", "2026-09-08"),
    ]);

    expect(results.sort()).toEqual(["failed", "ok"]);
  });

  it("under real concurrency, overlapping approved inserts on two different units both succeed", async () => {
    const attempt = (unitId: string, startDate: string, endDate: string) =>
      db
        .insert(booking)
        .values({ itemId, unitId, borrowerId: memberId, startDate, endDate, status: "approved" })
        .then(() => "ok" as const)
        .catch(() => "failed" as const);

    const results = await Promise.all([
      attempt(unitAId, "2026-10-01", "2026-10-05"),
      attempt(unitBId, "2026-10-03", "2026-10-08"),
    ]);

    expect(results).toEqual(["ok", "ok"]);
  });
});

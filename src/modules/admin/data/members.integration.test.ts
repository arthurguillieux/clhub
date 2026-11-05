/**
 * Integration test — needs a live Postgres with migrations applied (DATABASE_URL).
 * deleteMemberCascade never names the Killer tables: the games a member organized
 * leave with them through the foreign keys, so only a real database can prove it.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/core/db/client";
import { killerCohost, killerGame, killerKill, killerPlayer, member, user } from "@/core/db/schema";
import { deleteMemberCascade } from "./members";

async function createTestMember(): Promise<{ userId: string; memberId: string }> {
  const userId = randomUUID();
  await db
    .insert(user)
    .values({ id: userId, email: `test-${userId}@example.com`, name: "Test Member", emailVerified: true });
  const [created] = await db.insert(member).values({ userId }).returning();
  return { userId, memberId: created!.id };
}

async function createTestGame(hostMemberId: string): Promise<string> {
  const [game] = await db
    .insert(killerGame)
    .values({ code: `TEST-${randomUUID()}`, hostMemberId, title: "Test Game" })
    .returning({ id: killerGame.id });
  return game!.id;
}

describe("deleteMemberCascade with Killer games", () => {
  let organizer: { userId: string; memberId: string };
  let friend: { userId: string; memberId: string };
  let organizerGameId: string;
  let friendGameId: string;

  beforeAll(async () => {
    organizer = await createTestMember();
    friend = await createTestMember();

    organizerGameId = await createTestGame(organizer.memberId);
    const players = await db
      .insert(killerPlayer)
      .values([
        { gameId: organizerGameId, name: "Agent A", position: 0 },
        { gameId: organizerGameId, name: "Agent B", position: 1 },
      ])
      .returning({ id: killerPlayer.id });
    await db.insert(killerKill).values({
      gameId: organizerGameId,
      victimId: players[0]!.id,
      killerId: players[1]!.id,
      inheritedTargetId: players[1]!.id,
    });
    await db.insert(killerCohost).values({ gameId: organizerGameId, memberId: friend.memberId });

    // The other way round: they only help on this one, so it must outlive them.
    friendGameId = await createTestGame(friend.memberId);
    await db.insert(killerCohost).values({ gameId: friendGameId, memberId: organizer.memberId });
  });

  afterAll(async () => {
    await db.delete(killerGame).where(inArray(killerGame.id, [organizerGameId, friendGameId]));
    await db.delete(user).where(inArray(user.id, [organizer.userId, friend.userId]));
  });

  it("takes the games they organized with them, and leaves the games they only co-organized", async () => {
    await deleteMemberCascade(organizer.memberId);

    expect(await db.select().from(member).where(eq(member.id, organizer.memberId))).toHaveLength(0);

    const games = await db
      .select({ id: killerGame.id })
      .from(killerGame)
      .where(inArray(killerGame.id, [organizerGameId, friendGameId]));
    expect(games).toEqual([{ id: friendGameId }]);

    expect(await db.select().from(killerPlayer).where(eq(killerPlayer.gameId, organizerGameId))).toHaveLength(0);
    expect(await db.select().from(killerKill).where(eq(killerKill.gameId, organizerGameId))).toHaveLength(0);
    expect(await db.select().from(killerCohost).where(eq(killerCohost.gameId, organizerGameId))).toHaveLength(0);
    expect(await db.select().from(killerCohost).where(eq(killerCohost.gameId, friendGameId))).toHaveLength(0);

    expect(await db.select().from(member).where(eq(member.id, friend.memberId))).toHaveLength(1);
  });
});

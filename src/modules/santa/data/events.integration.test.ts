/**
 * Integration test — needs a live Postgres with migrations applied (DATABASE_URL).
 * The co-organization password is what keeps other members out of the panel, so its gate is
 * checked against the real tables rather than a mock.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/core/db/client";
import { member, santaCohost, santaEvent, user, type SantaEvent } from "@/core/db/schema";
import { createEvent, getEventByCode, isCohost, joinOrganization, redoNextYear, setCohostPassword, updateTheme } from "./events";

async function createTestMember(): Promise<{ userId: string; memberId: string }> {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, email: `test-${userId}@example.com`, name: "Test Member", emailVerified: true });
  const [created] = await db.insert(member).values({ userId }).returning();
  return { userId, memberId: created!.id };
}

describe("Secret Santa co-organization password", () => {
  let host: { userId: string; memberId: string };
  let friend: { userId: string; memberId: string };
  let event: SantaEvent;
  const fresh = async () => (await getEventByCode(event.code))!;

  beforeAll(async () => {
    host = await createTestMember();
    friend = await createTestMember();
    event = await createEvent(host.memberId, "Noël test 2026");
  });

  afterAll(async () => {
    await db.delete(santaEvent).where(eq(santaEvent.hostMemberId, host.memberId));
    await db.delete(santaEvent).where(eq(santaEvent.hostMemberId, friend.memberId));
    await db.delete(member).where(inArray(member.id, [host.memberId, friend.memberId]));
    await db.delete(user).where(inArray(user.id, [host.userId, friend.userId]));
  });

  it("keeps everyone out while there is no password", async () => {
    const result = await joinOrganization(event, friend.memberId, "peu importe");
    expect(result.ok).toBe(false);
    expect(await isCohost(event, friend.memberId)).toBe(false);
  });

  it("refuses a password that's too short", async () => {
    expect((await setCohostPassword(event, "abc")).ok).toBe(false);
    expect((await fresh()).cohostPassword).toBeNull();
  });

  it("stores a hash, never what was typed", async () => {
    await setCohostPassword(event, "Sapin2026");
    expect((await fresh()).cohostPassword).not.toContain("apin");
  });

  it("refuses the wrong password", async () => {
    const result = await joinOrganization(await fresh(), friend.memberId, "mauvais");
    expect(result).toEqual({ ok: false, error: "Ce n'est pas le bon mot de passe." });
    expect(await isCohost(event, friend.memberId)).toBe(false);
  });

  it("lets a member in with the right one, typed as it's said out loud, and only once", async () => {
    expect((await joinOrganization(await fresh(), friend.memberId, "  sapin2026 ")).ok).toBe(true);
    expect(await isCohost(event, friend.memberId)).toBe(true);
    expect((await joinOrganization(await fresh(), friend.memberId, "sapin2026")).ok).toBe(true);
    expect(await db.select().from(santaCohost).where(eq(santaCohost.eventId, event.id))).toHaveLength(1);
  });

  it("closes the door when the password is removed, without sending anyone out", async () => {
    await setCohostPassword(event, null);
    expect((await fresh()).cohostPassword).toBeNull();
    expect(await isCohost(event, friend.memberId)).toBe(true);
  });

  it("next year keeps the theme and the password", async () => {
    await setCohostPassword(event, "Sapin2026");
    await updateTheme(event, "blanc");
    const before = await fresh();
    const next = (await getEventByCode((await redoNextYear(before, host.memberId)).code))!;
    expect(next.theme).toBe("blanc");
    expect(next.cohostPassword).toBe(before.cohostPassword);
  });
});

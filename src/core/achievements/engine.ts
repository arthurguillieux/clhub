import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { achievement, member, memberAchievement, type Achievement } from "@/core/db/schema";
import { createNotification } from "@/core/notifications";
import { ACHIEVEMENTS } from "./catalog";
import { computeMemberStats } from "./stats";

/**
 * Idempotent — safe to run against a fresh DB or re-run any time
 * (drizzle-kit generate can't express seed data). Runs on every
 * syncMemberAchievements call (i.e. every Settings page view), so the
 * common case — nothing changed since last request — is a single cheap
 * SELECT rather than 14 sequential upserts. Only actually reseeds when a
 * key is missing (the real recurring case: a new achievement shipped in
 * catalog.ts). Editing an *existing* key's name/description/icon without
 * changing the key itself won't be picked up by this fast path.
 */
export async function seedAchievementCatalog(): Promise<void> {
  const existingKeys = new Set((await db.select({ key: achievement.key }).from(achievement)).map((r) => r.key));
  if (ACHIEVEMENTS.every((def) => existingKeys.has(def.key))) return;

  for (const def of ACHIEVEMENTS) {
    await db
      .insert(achievement)
      .values({
        key: def.key,
        name: def.name,
        description: def.description,
        hint: def.hint,
        icon: def.icon,
        secret: def.secret,
        sort: def.sort,
      })
      .onConflictDoUpdate({
        target: achievement.key,
        set: { name: def.name, description: def.description, hint: def.hint, icon: def.icon, secret: def.secret, sort: def.sort },
      });
  }
}

/** Evaluates every rule for one member and unlocks any newly-earned badge. Never revokes one already unlocked. */
export async function syncMemberAchievements(memberId: string): Promise<Achievement[]> {
  await seedAchievementCatalog();
  const stats = await computeMemberStats(memberId);
  const alreadyUnlocked = await db
    .select({ key: memberAchievement.achievementKey })
    .from(memberAchievement)
    .where(eq(memberAchievement.memberId, memberId));
  const unlockedKeys = new Set(alreadyUnlocked.map((r) => r.key));

  const newlyUnlocked: Achievement[] = [];
  for (const def of ACHIEVEMENTS) {
    if (unlockedKeys.has(def.key)) continue;
    if (!def.evaluate(stats)) continue;

    await db.insert(memberAchievement).values({ memberId, achievementKey: def.key });
    const [row] = await db.select().from(achievement).where(eq(achievement.key, def.key));
    if (row) newlyUnlocked.push(row);
  }

  for (const unlocked of newlyUnlocked) {
    await createNotification({
      memberId,
      kind: "achievement.unlocked",
      entityRef: `achievement:${unlocked.key}`,
      payload: { name: unlocked.name, icon: unlocked.icon },
    });
  }

  return newlyUnlocked;
}

/** Run for every member — the cron entry point (see modules/pretotheque/data/scheduledTasks.ts). */
export async function syncAllAchievements(): Promise<number> {
  const members = await db.select({ id: member.id }).from(member);
  let totalUnlocked = 0;
  for (const m of members) {
    const unlocked = await syncMemberAchievements(m.id);
    totalUnlocked += unlocked.length;
  }
  return totalUnlocked;
}

export interface MemberBadge {
  key: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
}

export async function listUnlockedBadges(memberId: string): Promise<MemberBadge[]> {
  const rows = await db
    .select({
      key: achievement.key,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      unlockedAt: memberAchievement.unlockedAt,
    })
    .from(memberAchievement)
    .innerJoin(achievement, eq(achievement.key, memberAchievement.achievementKey))
    .where(eq(memberAchievement.memberId, memberId))
    .orderBy(achievement.sort);
  return rows;
}

export interface CatalogEntry {
  key: string;
  name: string;
  description: string | null; // null = secret and not yet unlocked, hint shown instead
  hint: string | null;
  icon: string;
  secret: boolean;
  unlocked: boolean;
}

/**
 * For a "mes écussons" view: the full catalog, secret badges' descriptions
 * withheld until unlocked. Doesn't seed the catalog itself — its one caller
 * (Settings) always runs syncMemberAchievements first in the same request,
 * which already does. Re-seeding here too was 14 redundant upsert queries
 * on every single page view for no effect.
 */
export async function listCatalogForMember(memberId: string): Promise<CatalogEntry[]> {
  const [all, unlockedRows] = await Promise.all([
    db.select().from(achievement).orderBy(achievement.sort),
    db
      .select({ key: memberAchievement.achievementKey })
      .from(memberAchievement)
      .where(eq(memberAchievement.memberId, memberId)),
  ]);
  const unlockedKeys = new Set(unlockedRows.map((r) => r.key));

  return all.map((a) => {
    const unlocked = unlockedKeys.has(a.key);
    return {
      key: a.key,
      name: a.secret && !unlocked ? "???" : a.name,
      description: a.secret && !unlocked ? null : a.description,
      hint: a.hint,
      icon: a.icon,
      secret: a.secret,
      unlocked,
    };
  });
}

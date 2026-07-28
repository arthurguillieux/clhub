"use server";

import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member } from "@/core/db/schema";
import { getSession } from "@/core/auth/session";
import { syncMemberAchievements } from "@/core/achievements/engine";

/**
 * Each of these sets a one-way flag on the current session's member, then
 * syncs achievements immediately so the unlock notification fires right
 * away rather than waiting for the member's next Settings visit (the only
 * other place syncMemberAchievements runs today). Silently no-ops if
 * there's no session — these are called from public-feeling client
 * interactions, not gated actions, so there's nothing to report back.
 */
async function markFlagOnce(flag: "foundKonamiCode" | "rolledNaturalTwenty" | "rolledNaturalOne"): Promise<void> {
  const session = await getSession();
  if (!session || session.member[flag]) return;

  await db.update(member).set({ [flag]: true }).where(eq(member.id, session.member.id));
  await syncMemberAchievements(session.member.id);
}

export async function recordKonamiCodeFoundAction(): Promise<void> {
  await markFlagOnce("foundKonamiCode");
}

export async function recordNaturalTwentyAction(): Promise<void> {
  await markFlagOnce("rolledNaturalTwenty");
}

export async function recordNaturalOneAction(): Promise<void> {
  await markFlagOnce("rolledNaturalOne");
}

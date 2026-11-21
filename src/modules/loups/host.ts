import { getSession } from "@/core/auth/session";
import type { WolfGame } from "@/core/db/schema";
import { getGameByCode } from "./data/games";

export type MeneurCheck = { ok: true; game: WolfGame; memberId: string } | { ok: false; reason: "signed-out" | "missing" | "not-meneur" };

/** The meneur's page and moves: signed in, and the game is theirs. Nobody else, admins included: they may be playing. */
export async function checkMeneur(code: string): Promise<MeneurCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  const game = await getGameByCode(code);
  if (!game) return { ok: false, reason: "missing" };
  if (game.hostMemberId !== session.member.id) return { ok: false, reason: "not-meneur" };
  return { ok: true, game, memberId: session.member.id };
}

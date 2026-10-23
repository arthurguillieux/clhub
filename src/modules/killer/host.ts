import { getSession } from "@/core/auth/session";
import type { KillerGame } from "@/core/db/schema";
import { hasKillerAccess } from "./access";
import { getGameByCode, isCohost } from "./data/games";

export type HostCheck =
  | { ok: true; game: KillerGame; memberId: string; role: "host" | "cohost" }
  | { ok: false; reason: "signed-out" | "locked" | "missing" | "not-host" };

/**
 * The organizer's screens (panel, TV) and actions: signed in, Killer password
 * entered, and the game must be theirs — created by them ("host") or shared
 * with them by its creator ("cohost"). Club admins get no bypass on purpose —
 * some of them will be playing.
 */
export async function checkKillerHost(code: string): Promise<HostCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  if (!(await hasKillerAccess(session.member.id))) return { ok: false, reason: "locked" };
  const game = await getGameByCode(code);
  if (!game) return { ok: false, reason: "missing" };
  if (game.hostMemberId === session.member.id) return { ok: true, game, memberId: session.member.id, role: "host" };
  if (await isCohost(game, session.member.id)) return { ok: true, game, memberId: session.member.id, role: "cohost" };
  return { ok: false, reason: "not-host" };
}

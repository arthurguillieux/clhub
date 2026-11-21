"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/core/auth/session";
import {
  claimSeat,
  createGame,
  deleteGame,
  endGame,
  findOrAddPlayer,
  getGameByToken,
  getHostView,
  getPlayerView,
  launch,
  markSeen,
  play,
  saveRule,
  saveSetup,
  startNight,
  type Command,
  type Result,
} from "@/modules/loups/data/games";
import { MAX_PLAYERS } from "@/modules/loups/domain/deck";
import { ROLES } from "@/modules/loups/domain/roles";
import { checkMeneur } from "@/modules/loups/host";
import type { HostView, PlayerView } from "@/modules/loups/views";

export async function newGameAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const game = await createGame(session.member.id, null);
  redirect(`/loups/${game.code}/meneur`);
}

const id = z.string().uuid();
const roleId = z.enum(ROLES.map((r) => r.id) as [string, ...string[]]);
const cause = z.enum(["loups", "sorciere", "loupblanc", "vote", "barbier", "chagrin", "chasseur", "meneur", "autre"]);
const deaths = z.array(z.object({ seat: id, cause, role: roleId.optional() })).max(MAX_PLAYERS);
const winner = z.enum(["village", "loups", "amoureux", "loupblanc", "personne"]);

const command = z.discriminatedUnion("t", [
  z.object({ t: z.literal("assign"), seat: id, role: roleId }),
  z.object({ t: z.literal("step"), step: z.string().max(20), done: z.boolean() }),
  z.object({ t: z.literal("lovers"), a: id, b: id }),
  z.object({ t: z.literal("model"), seat: id }),
  z.object({ t: z.literal("protect"), seat: id.nullable() }),
  z.object({ t: z.literal("victim"), seat: id.nullable() }),
  z.object({ t: z.literal("wolves"), seats: z.array(id).max(MAX_PLAYERS) }),
  z.object({ t: z.literal("plague"), on: z.boolean() }),
  z.object({ t: z.literal("infect"), on: z.boolean() }),
  z.object({ t: z.literal("whiteWolf"), seat: id.nullable() }),
  z.object({ t: z.literal("witch"), heal: z.boolean(), poison: id.nullable() }),
  z.object({ t: z.literal("dawn"), deaths }),
  z.object({ t: z.literal("barber"), barber: id, deaths }),
  z.object({ t: z.literal("vote"), target: id.nullable(), spared: z.boolean(), servant: id.nullable(), deaths }),
  z.object({ t: z.literal("judge") }),
  z.object({ t: z.literal("kill"), deaths }),
  z.object({ t: z.literal("dusk") }),
  z.object({ t: z.literal("order"), order: z.array(z.string().max(20)).max(30) }),
  z.object({ t: z.literal("undo") }),
]);

const meneurSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("refresh") }),
  z.object({
    type: z.literal("setup"),
    playerIds: z.array(id).max(MAX_PLAYERS, `${MAX_PLAYERS} joueurs au plus.`),
    deck: z.partialRecord(roleId, z.number().int().min(0).max(MAX_PLAYERS)),
    plague: z.boolean(),
    dealMode: z.enum(["cards", "app"]),
  }),
  z.object({
    type: z.literal("addPlayer"),
    name: z.string().trim().max(40, "Prénom trop long.").optional(),
    memberId: id.optional(),
  }),
  z.object({ type: z.literal("launch") }),
  z.object({ type: z.literal("startNight") }),
  z.object({ type: z.literal("seen"), seat: id, seen: z.boolean() }),
  z.object({ type: z.literal("play"), command }),
  z.object({ type: z.literal("end"), winner, blackPlague: z.boolean() }),
]);

export type MeneurResult = { ok: true; view: HostView; playerId?: string } | { ok: false; error: string };

/** Everything the meneur does on the game's page; each call answers with the page as it now is. */
export async function meneurAction(code: string, action: unknown): Promise<MeneurResult> {
  const check = await checkMeneur(code);
  if (!check.ok) return { ok: false, error: "Ce n'est pas ta partie." };
  const parsed = meneurSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const g = check.game;
  let playerId: string | undefined;

  const result: Result = await (async (): Promise<Result> => {
    switch (a.type) {
      case "refresh":
        return { ok: true };
      case "setup":
        return saveSetup(g, { playerIds: a.playerIds, deck: a.deck, plague: a.plague, dealMode: a.dealMode });
      case "addPlayer": {
        const found = await findOrAddPlayer(g.hostMemberId, a.memberId ? { memberId: a.memberId } : { name: a.name ?? "" });
        if (!found.ok) return found;
        playerId = found.id;
        return { ok: true };
      }
      case "launch":
        return launch(g);
      case "startNight":
        return startNight(g);
      case "seen":
        return markSeen(g, a.seat, a.seen);
      case "play":
        return play(g, a.command as Command);
      case "end":
        return endGame(g, a.winner, a.blackPlague);
    }
  })();
  if (!result.ok) return result;
  const fresh = await checkMeneur(code);
  return fresh.ok ? { ok: true, view: await getHostView(fresh.game), playerId } : { ok: false, error: "Cette partie n'existe plus." };
}

/** « Rejouer » (same table, same deck, dealt at once) or « Ajuster » (same table, back to the setup). */
export async function replayAction(code: string, adjust: boolean): Promise<void> {
  const check = await checkMeneur(code);
  if (!check.ok) redirect("/jeux/loups");
  const next = await createGame(check.memberId, check.game);
  if (!adjust) await launch(next);
  redirect(`/loups/${next.code}/meneur`);
}

export async function deleteGameAction(code: string): Promise<void> {
  const check = await checkMeneur(code);
  if (check.ok) await deleteGame(check.game);
  redirect("/jeux/loups");
}

export async function ruleAction(role: string, text: string | null): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Connecte-toi d'abord." };
  if (text !== null && text.length > 1500) return { ok: false, error: "Règle trop longue." };
  return saveRule(session.member.id, role, text);
}

// ───────── The players' phones ─────────

const playerSchema = z.discriminatedUnion("t", [z.object({ t: z.literal("view") }), z.object({ t: z.literal("claim"), seat: id })]);
const key = z.string().regex(/^[\w-]{16,64}$/).nullable();

export type PlayerResult = { ok: true; view: PlayerView; key: string | null } | { ok: false; error: string; view?: PlayerView };

/** What a player's phone asks, with the key it keeps once its player said « c'est moi ». */
export async function playerAction(token: string, rawKey: unknown, action: unknown): Promise<PlayerResult> {
  const g = await getGameByToken(token);
  if (!g) return { ok: false, error: "Cette partie n'existe plus." };
  const parsed = playerSchema.safeParse(action);
  const k = key.safeParse(rawKey);
  if (!parsed.success || !k.success) return { ok: false, error: "Action invalide." };
  let mine = k.data;
  if (parsed.data.t === "claim") {
    const claimed = await claimSeat(g, parsed.data.seat);
    if (!claimed.ok) return { ok: false, error: claimed.error, view: await getPlayerView(g, mine) };
    mine = claimed.key;
  }
  return { ok: true, view: await getPlayerView(g, mine), key: mine };
}

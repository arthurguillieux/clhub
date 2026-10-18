import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { killerGame, killerKill, killerPlayer, type KillerGame } from "@/core/db/schema";
import {
  buildCircle,
  circleNames,
  eliminate,
  endStats,
  insertLate,
  shuffledOrder,
  undoKill,
  type Patch,
  type Tribute,
} from "../domain/circle";
import type { GameStatus, HostGameView, PlayerGameView, PublicGameView, PublicTribute } from "../views";
import { notifyGame } from "./notifier";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_NAME_LENGTH = 30;
export const MAX_MISSION_LENGTH = 600;

export type Result<T = void> = ({ ok: true } & (T extends void ? object : { value: T })) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

// ───────── Reading ─────────

const playerColumns = {
  id: killerPlayer.id,
  name: killerPlayer.name,
  mission: killerPlayer.mission,
  position: killerPlayer.position,
  token: killerPlayer.token,
  photoVersion: killerPlayer.photoVersion,
  hasPhoto: sql<boolean>`${killerPlayer.photo} is not null`,
  targetId: killerPlayer.targetId,
  alive: killerPlayer.alive,
  killedAt: killerPlayer.killedAt,
  killedById: killerPlayer.killedById,
  joinedAt: killerPlayer.joinedAt,
};
type PlayerRow = Awaited<ReturnType<typeof loadPlayers>>[number];

async function loadPlayers(gameId: string, tx: Tx | typeof db = db) {
  return tx.select(playerColumns).from(killerPlayer).where(eq(killerPlayer.gameId, gameId)).orderBy(asc(killerPlayer.position));
}

const asTributes = (rows: PlayerRow[]): Tribute[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    targetId: r.targetId,
    alive: r.alive,
    killedAt: r.killedAt,
    killedById: r.killedById,
  }));

export async function getGameByCode(code: string): Promise<KillerGame | null> {
  const [game] = await db.select().from(killerGame).where(eq(killerGame.code, code.trim().toUpperCase())).limit(1);
  return game ?? null;
}

export async function listGamesByHost(memberId: string): Promise<KillerGame[]> {
  return db.select().from(killerGame).where(eq(killerGame.hostMemberId, memberId)).orderBy(desc(killerGame.createdAt));
}

function publicTribute(r: PlayerRow): PublicTribute {
  return {
    id: r.id,
    name: r.name,
    joined: r.token !== null,
    photoVersion: r.hasPhoto ? r.photoVersion : null,
    alive: r.alive,
    killedAt: r.killedAt?.toISOString() ?? null,
  };
}

function publicView(game: KillerGame, rows: PlayerRow[]): PublicGameView {
  const fallen = rows.filter((r) => !r.alive && r.killedAt).sort((a, b) => b.killedAt!.getTime() - a.killedAt!.getTime());
  const last = fallen[0];
  return {
    code: game.code,
    title: game.title,
    status: game.status as GameStatus,
    version: game.version,
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    tributes: rows.map(publicTribute),
    aliveCount: rows.filter((r) => r.alive).length,
    lastFall: last
      ? { id: last.id, name: last.name, at: last.killedAt!.toISOString(), photoVersion: last.hasPhoto ? last.photoVersion : null }
      : null,
    falls: fallen.length,
    stats: game.status === "ended" ? endStats(asTributes(rows), game.startedAt, game.endedAt) : null,
  };
}

export async function getPublicView(game: KillerGame): Promise<PublicGameView> {
  return publicView(game, await loadPlayers(game.id));
}

/** The phone's view; null if the token doesn't belong to this game (seat released, game deleted…). */
export async function getPlayerView(game: KillerGame, token: string): Promise<PlayerGameView | null> {
  const rows = await loadPlayers(game.id);
  const me = rows.find((r) => r.token === token);
  if (!me) return null;
  const target = game.status === "running" && me.alive && me.targetId && me.targetId !== me.id ? rows.find((r) => r.id === me.targetId) : undefined;
  return {
    ...publicView(game, rows),
    me: {
      id: me.id,
      name: me.name,
      alive: me.alive,
      hasPhoto: me.hasPhoto,
      target: target ? { id: target.id, name: target.name, photoVersion: target.hasPhoto ? target.photoVersion : null } : null,
      mission: target ? target.mission : null,
    },
  };
}

export async function getHostView(game: KillerGame): Promise<HostGameView> {
  const rows = await loadPlayers(game.id);
  const [lastKill] = await db.select({ id: killerKill.id }).from(killerKill).where(eq(killerKill.gameId, game.id)).limit(1);
  const pub = publicView(game, rows);
  return {
    ...pub,
    tributes: rows.map((r) => ({ ...publicTribute(r), mission: r.mission, position: r.position, targetId: r.targetId, killedById: r.killedById })),
    circle: game.status === "lobby" ? [...rows.map((r) => r.name), ...(rows[0] ? [rows[0].name] : [])] : circleNames(asTributes(rows)),
    canUndo: !!lastKill && game.status !== "lobby",
  };
}

export async function getPhoto(game: KillerGame, playerId: string): Promise<Buffer | null> {
  const [row] = await db
    .select({ photo: killerPlayer.photo })
    .from(killerPlayer)
    .where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.id, playerId)))
    .limit(1);
  return row?.photo ?? null;
}

// ───────── Writing ─────────

/** Every change goes through here: bump the version in the same transaction, wake the pollers after commit. */
async function mutate<T>(gameId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await db.transaction(async (tx) => {
    const value = await fn(tx);
    await tx.update(killerGame).set({ version: sql`${killerGame.version} + 1` }).where(eq(killerGame.id, gameId));
    return value;
  });
  notifyGame(gameId);
  return result;
}

async function applyPatches(tx: Tx, patches: Patch[]) {
  for (const { id, ...patch } of patches) {
    await tx.update(killerPlayer).set(patch).where(eq(killerPlayer.id, id));
  }
}

export async function createGame(hostMemberId: string, title: string): Promise<KillerGame> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [game] = await db.insert(killerGame).values({ code, hostMemberId, title }).onConflictDoNothing().returning();
    if (game) return game;
  }
}

export interface LobbyRow {
  id: string | null;
  name: string;
  mission: string;
}

/** Saves the organizer's list as-is: order = circle, rows left out are removed. Lobby only. */
export async function saveLobby(game: KillerGame, rows: LobbyRow[]): Promise<Result> {
  if (game.status !== "lobby") return fail("La partie a déjà commencé.");
  const names = rows.map((r) => r.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return fail("Deux joueurs ont le même prénom — ajoute une initiale pour les distinguer.");

  await mutate(game.id, async (tx) => {
    const existing = await loadPlayers(game.id, tx);
    const keptIds = new Set(rows.map((r) => r.id).filter(Boolean));
    for (const old of existing) {
      if (!keptIds.has(old.id)) await tx.delete(killerPlayer).where(eq(killerPlayer.id, old.id));
    }
    for (const [position, row] of rows.entries()) {
      const values = { name: row.name.trim(), mission: row.mission.trim(), position };
      if (row.id && existing.some((e) => e.id === row.id)) {
        await tx.update(killerPlayer).set(values).where(eq(killerPlayer.id, row.id));
      } else {
        await tx.insert(killerPlayer).values({ gameId: game.id, ...values });
      }
    }
  });
  return { ok: true };
}

export async function shuffleLobby(game: KillerGame): Promise<Result> {
  if (game.status !== "lobby") return fail("La partie a déjà commencé.");
  await mutate(game.id, async (tx) => {
    const rows = await loadPlayers(game.id, tx);
    const order = shuffledOrder(rows, Math.random);
    for (const [position, row] of order.entries()) {
      await tx.update(killerPlayer).set({ position }).where(eq(killerPlayer.id, row.id));
    }
  });
  return { ok: true };
}

export async function startGame(game: KillerGame): Promise<Result> {
  if (game.status !== "lobby") return fail("La partie a déjà commencé.");
  const rows = await loadPlayers(game.id);
  if (rows.length < 2) return fail("Il faut au moins deux tributs.");
  if (rows.some((r) => !r.mission.trim())) return fail("Chaque tribut doit avoir une mission avant le lancement.");
  await mutate(game.id, async (tx) => {
    await applyPatches(tx, buildCircle(rows));
    await tx.update(killerGame).set({ status: "running", startedAt: new Date() }).where(eq(killerGame.id, game.id));
  });
  return { ok: true };
}

/** A guest taps their name: the seat is theirs if nobody claimed it yet. */
export async function claimSeat(game: KillerGame, playerId: string): Promise<Result<string>> {
  if (game.status === "ended") return fail("La partie est terminée.");
  const token = randomBytes(16).toString("hex");
  const claimed = await mutate(game.id, async (tx) =>
    tx
      .update(killerPlayer)
      .set({ token, joinedAt: new Date() })
      .where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.id, playerId), isNull(killerPlayer.token)))
      .returning({ id: killerPlayer.id }),
  );
  if (claimed.length === 0) return fail("Ce prénom est déjà pris. Si c'est bien toi, demande à l'organisateur de libérer ta place.");
  return { ok: true, value: token };
}

export async function setPhoto(game: KillerGame, token: string, photo: Buffer): Promise<Result> {
  const updated = await mutate(game.id, async (tx) =>
    tx
      .update(killerPlayer)
      .set({ photo, photoVersion: sql`${killerPlayer.photoVersion} + 1` })
      .where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.token, token)))
      .returning({ id: killerPlayer.id }),
  );
  return updated.length ? { ok: true } : fail("Joueur inconnu.");
}

/** For a guest who lost their phone's memory (other browser, private tab): they can claim the name again. */
export async function releaseSeat(game: KillerGame, playerId: string): Promise<Result> {
  await mutate(game.id, (tx) =>
    tx.update(killerPlayer).set({ token: null }).where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.id, playerId))),
  );
  return { ok: true };
}

export async function updateMission(game: KillerGame, playerId: string, mission: string): Promise<Result> {
  if (!mission.trim()) return fail("La mission ne peut pas être vide.");
  await mutate(game.id, (tx) =>
    tx
      .update(killerPlayer)
      .set({ mission: mission.trim() })
      .where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.id, playerId))),
  );
  return { ok: true };
}

export async function eliminatePlayer(game: KillerGame, victimId: string): Promise<Result> {
  if (game.status !== "running") return fail("La partie n'est pas en cours.");
  let outcome: Result = { ok: true };
  await mutate(game.id, async (tx) => {
    const rows = await loadPlayers(game.id, tx);
    const now = new Date();
    const r = eliminate(asTributes(rows), victimId, now);
    if (!r.ok) {
      outcome = fail(r.error);
      return;
    }
    await applyPatches(tx, r.patches);
    await tx.insert(killerKill).values({ gameId: game.id, ...r.kill, createdAt: now });
    if (r.finished) await tx.update(killerGame).set({ status: "ended", endedAt: now }).where(eq(killerGame.id, game.id));
  });
  return outcome;
}

export async function undoLastKill(game: KillerGame): Promise<Result> {
  if (game.status === "lobby") return fail("Rien à annuler.");
  let outcome: Result = { ok: true };
  await mutate(game.id, async (tx) => {
    const [last] = await tx.select().from(killerKill).where(eq(killerKill.gameId, game.id)).orderBy(desc(killerKill.createdAt)).limit(1);
    if (!last) {
      outcome = fail("Aucune élimination à annuler.");
      return;
    }
    await applyPatches(tx, undoKill(last));
    await tx.delete(killerKill).where(eq(killerKill.id, last.id));
    if (game.status === "ended") await tx.update(killerGame).set({ status: "running", endedAt: null }).where(eq(killerGame.id, game.id));
  });
  return outcome;
}

/** Adds a tribute: in the lobby at the end of the list; during the game, slotted right after `afterId` (or a random living tribute). */
export async function addTribute(game: KillerGame, name: string, mission: string, afterId: string | null): Promise<Result> {
  if (game.status === "ended") return fail("La partie est terminée.");
  const rows = await loadPlayers(game.id);
  if (rows.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase())) return fail("Ce prénom existe déjà dans la partie.");
  if (game.status === "running" && !mission.trim()) return fail("Donne-lui une mission.");

  let outcome: Result = { ok: true };
  await mutate(game.id, async (tx) => {
    const position = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
    const [created] = await tx
      .insert(killerPlayer)
      .values({ gameId: game.id, name: name.trim(), mission: mission.trim(), position })
      .returning({ id: killerPlayer.id });
    if (game.status !== "running" || !created) return;

    const tributes = asTributes(rows);
    const living = tributes.filter((t) => t.alive);
    const hostId = afterId ?? living[randomInt(living.length)]?.id ?? "";
    const r = insertLate([...tributes, { id: created.id, name, position, targetId: null, alive: true, killedAt: null, killedById: null }], created.id, hostId);
    if (!r.ok) {
      outcome = fail(r.error);
      throw new Error("rollback");
    }
    await applyPatches(tx, r.patches);
  }).catch((e: unknown) => {
    if (!(e instanceof Error && e.message === "rollback")) throw e;
  });
  return outcome;
}

export async function endGame(game: KillerGame): Promise<Result> {
  if (game.status !== "running") return fail("La partie n'est pas en cours.");
  await mutate(game.id, (tx) => tx.update(killerGame).set({ status: "ended", endedAt: new Date() }).where(eq(killerGame.id, game.id)));
  return { ok: true };
}

/** Removes the game with its players, photos and kills (cascade). */
export async function deleteGame(game: KillerGame): Promise<void> {
  await db.delete(killerGame).where(eq(killerGame.id, game.id));
  notifyGame(game.id);
}

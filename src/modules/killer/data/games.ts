import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { killerCohost, killerGame, killerKill, killerPlayer, member, user, type KillerGame } from "@/core/db/schema";
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
import { hashPassword, verifyPassword } from "../password";
import type { ArchiveView, GameStatus, HostGameView, PlayerGameView, PublicGameView, PublicTribute } from "../views";
import { notifyGame } from "./notifier";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const MAX_NAME_LENGTH = 30;
export const MAX_MISSION_LENGTH = 600;

export type Result<T = void> = ({ ok: true } & (T extends void ? object : { value: T })) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

// ───────── Reading ─────────

// Every poll reads the game: leave the sound file (up to a few hundred KB) out of it.
const allGameColumns = getTableColumns(killerGame);
const gameColumns = Object.fromEntries(Object.entries(allGameColumns).filter(([key]) => key !== "sound" && key !== "countdownSound")) as Omit<
  typeof allGameColumns,
  "sound" | "countdownSound"
>;

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
  const [game] = await db.select(gameColumns).from(killerGame).where(eq(killerGame.code, code.trim().toUpperCase())).limit(1);
  return game ?? null;
}

export async function listGamesByHost(memberId: string): Promise<KillerGame[]> {
  return db.select(gameColumns).from(killerGame).where(eq(killerGame.hostMemberId, memberId)).orderBy(desc(killerGame.createdAt));
}

/** The games a member runs: the ones they created, and the ones they co-organize. Newest first. */
export async function listGamesForMember(memberId: string): Promise<(KillerGame & { role: "host" | "cohost" })[]> {
  const cohosted = db.select({ gameId: killerCohost.gameId }).from(killerCohost).where(eq(killerCohost.memberId, memberId));
  const games = await db
    .select(gameColumns)
    .from(killerGame)
    .where(or(eq(killerGame.hostMemberId, memberId), inArray(killerGame.id, cohosted)))
    .orderBy(desc(killerGame.createdAt));
  return games.map((g) => ({ ...g, role: g.hostMemberId === memberId ? "host" : "cohost" }));
}

export async function isCohost(game: KillerGame, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: killerCohost.id })
    .from(killerCohost)
    .where(and(eq(killerCohost.gameId, game.id), eq(killerCohost.memberId, memberId)))
    .limit(1);
  return !!row;
}

async function listCohosts(gameId: string): Promise<HostGameView["cohosts"]> {
  return db
    .select({ memberId: killerCohost.memberId, name: user.name })
    .from(killerCohost)
    .innerJoin(member, eq(member.id, killerCohost.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(killerCohost.gameId, gameId))
    .orderBy(asc(killerCohost.createdAt));
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

/**
 * A fixed but meaningless order for everything guests and the TV see — players are stored in circle
 * order, and showing them that way told everyone who hunts whom. Hashing the game and player ids
 * gives the same order on every screen and every refresh, unrelated to the circle.
 */
function scrambleKey(gameId: string, playerId: string): number {
  let h = 0x811c9dc5;
  for (const c of `${gameId}:${playerId}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h;
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
    tributes: [...rows].sort((a, b) => scrambleKey(game.id, a.id) - scrambleKey(game.id, b.id)).map(publicTribute),
    aliveCount: rows.filter((r) => r.alive).length,
    lastFall: last
      ? { id: last.id, name: last.name, at: last.killedAt!.toISOString(), photoVersion: last.hasPhoto ? last.photoVersion : null }
      : null,
    falls: fallen.length,
    soundVersion: game.soundType ? game.soundVersion : null,
    countdownSoundVersion: game.countdownSoundType ? game.countdownSoundVersion : null,
    now: new Date().toISOString(),
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
    cohosts: await listCohosts(game.id),
    hasCohostPassword: !!game.cohostPassword,
    archived: !!game.archivedAt,
  };
}

/** Everything about a finished game, for its archive page: results, every agent, every elimination. */
export async function getArchiveView(game: KillerGame): Promise<ArchiveView> {
  const rows = await loadPlayers(game.id);
  const kills = await db.select().from(killerKill).where(eq(killerKill.gameId, game.id)).orderBy(asc(killerKill.createdAt));
  const nameOf = new Map(rows.map((r) => [r.id, r.name]));
  const missionOf = new Map(rows.map((r) => [r.id, r.mission]));
  const killCount = new Map<string, number>();
  for (const k of kills) killCount.set(k.killerId, (killCount.get(k.killerId) ?? 0) + 1);
  return {
    code: game.code,
    title: game.title,
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    stats: game.status === "ended" ? endStats(asTributes(rows), game.startedAt, game.endedAt) : null,
    agents: rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        photoVersion: r.hasPhoto ? r.photoVersion : null,
        alive: r.alive,
        killedAt: r.killedAt?.toISOString() ?? null,
        killedBy: r.killedById ? (nameOf.get(r.killedById) ?? null) : null,
        kills: killCount.get(r.id) ?? 0,
        mission: r.mission,
      }))
      .sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills || (b.killedAt ?? "").localeCompare(a.killedAt ?? "")),
    kills: kills.map((k) => ({
      at: k.createdAt.toISOString(),
      killer: nameOf.get(k.killerId) ?? "?",
      victim: nameOf.get(k.victimId) ?? "?",
      mission: missionOf.get(k.victimId) ?? "",
    })),
  };
}

/** Every player's photo, for the organizers to send them out after the game. */
export async function getAllPhotos(game: KillerGame): Promise<{ name: string; photo: Buffer }[]> {
  const rows = await db
    .select({ name: killerPlayer.name, photo: killerPlayer.photo })
    .from(killerPlayer)
    .where(eq(killerPlayer.gameId, game.id))
    .orderBy(asc(killerPlayer.name));
  return rows.filter((r): r is { name: string; photo: Buffer } => r.photo !== null);
}

/** The organizer's two sounds: one for each elimination, one for the launch countdown. */
export type SoundKind = "elimination" | "countdown";

export async function getGameSound(game: KillerGame, kind: SoundKind): Promise<{ data: Buffer; type: string } | null> {
  const columns =
    kind === "countdown" ? { data: killerGame.countdownSound, type: killerGame.countdownSoundType } : { data: killerGame.sound, type: killerGame.soundType };
  const [row] = await db.select(columns).from(killerGame).where(eq(killerGame.id, game.id)).limit(1);
  return row?.data && row.type ? { data: row.data, type: row.type } : null;
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
  if (rows.length < 2) return fail("Il faut au moins deux agents.");
  if (rows.some((r) => !r.mission.trim())) return fail("Chaque agent doit avoir une mission avant le lancement.");
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

/** Sets or removes the co-organization password. */
export async function setCohostPassword(game: KillerGame, password: string | null): Promise<Result> {
  if (password !== null && password.trim().length < 4) return fail("Le mot de passe doit faire au moins 4 caractères.");
  await mutate(game.id, (tx) =>
    tx
      .update(killerGame)
      .set({ cohostPassword: password === null ? null : hashPassword(password) })
      .where(eq(killerGame.id, game.id)),
  );
  return { ok: true };
}

/** A member types the game's co-organization password and joins its organization. */
export async function joinOrganization(game: KillerGame, memberId: string, password: string): Promise<Result> {
  if (memberId === game.hostMemberId) return { ok: true };
  if (!game.cohostPassword) return fail("Cette partie n'a pas de mot de passe de co-organisation : demande à son organisateur de t'ajouter.");
  if (!verifyPassword(password, game.cohostPassword)) return fail("Ce n'est pas le bon mot de passe.");
  await mutate(game.id, (tx) => tx.insert(killerCohost).values({ gameId: game.id, memberId }).onConflictDoNothing());
  return { ok: true };
}

/** Files a finished game away (read-only summary), or brings it back. */
export async function setArchived(game: KillerGame, archived: boolean): Promise<Result> {
  if (archived && game.status !== "ended") return fail("Seule une partie terminée peut être archivée.");
  await mutate(game.id, (tx) => tx.update(killerGame).set({ archivedAt: archived ? new Date() : null }).where(eq(killerGame.id, game.id)));
  return { ok: true };
}

/** Deletes every player's photo, keeping the game, its results and its history. */
export async function removeAllPhotos(game: KillerGame): Promise<Result> {
  await mutate(game.id, (tx) =>
    tx
      .update(killerPlayer)
      .set({ photo: null, photoVersion: sql`${killerPlayer.photoVersion} + 1` })
      .where(eq(killerPlayer.gameId, game.id)),
  );
  return { ok: true };
}

/** The creator lets another member run the game with them. */
export async function addCohost(game: KillerGame, memberId: string): Promise<Result> {
  if (memberId === game.hostMemberId) return fail("Tu organises déjà cette partie.");
  const [exists] = await db.select({ id: member.id }).from(member).where(eq(member.id, memberId)).limit(1);
  if (!exists) return fail("Membre introuvable.");
  await mutate(game.id, (tx) => tx.insert(killerCohost).values({ gameId: game.id, memberId }).onConflictDoNothing());
  return { ok: true };
}

export async function removeCohost(game: KillerGame, memberId: string): Promise<Result> {
  await mutate(game.id, (tx) => tx.delete(killerCohost).where(and(eq(killerCohost.gameId, game.id), eq(killerCohost.memberId, memberId))));
  return { ok: true };
}

export const MAX_TITLE_LENGTH = 80;

/** Renames the game, whatever its state — the TV and the phones pick up the new title on their next update. */
export async function renameGame(game: KillerGame, title: string): Promise<Result> {
  const clean = title.trim();
  if (!clean) return fail("Le nom de la partie ne peut pas être vide.");
  await mutate(game.id, (tx) => tx.update(killerGame).set({ title: clean.slice(0, MAX_TITLE_LENGTH) }).where(eq(killerGame.id, game.id)));
  return { ok: true };
}

/** The organizer's own elimination sound; null puts the synthesised cannon back. */
export async function setGameSound(game: KillerGame, kind: SoundKind, sound: { data: Buffer; type: string } | null): Promise<Result> {
  const values =
    kind === "countdown"
      ? { countdownSound: sound?.data ?? null, countdownSoundType: sound?.type ?? null, countdownSoundVersion: sql`${killerGame.countdownSoundVersion} + 1` }
      : { sound: sound?.data ?? null, soundType: sound?.type ?? null, soundVersion: sql`${killerGame.soundVersion} + 1` };
  await mutate(game.id, (tx) => tx.update(killerGame).set(values).where(eq(killerGame.id, game.id)));
  return { ok: true };
}

/** The organizer removes a bad photo: the guest's phone goes back to the photo step on its own. */
export async function removePhoto(game: KillerGame, playerId: string): Promise<Result> {
  await mutate(game.id, (tx) =>
    tx
      .update(killerPlayer)
      .set({ photo: null, photoVersion: sql`${killerPlayer.photoVersion} + 1` })
      .where(and(eq(killerPlayer.gameId, game.id), eq(killerPlayer.id, playerId))),
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

/**
 * Back to the preparation screen, as if the game had never been launched: everyone alive again,
 * no targets, no kill history. Seats and photos are kept, so nobody has to sign up again.
 */
export async function resetToLobby(game: KillerGame): Promise<Result> {
  if (game.status === "lobby") return fail("La partie est déjà en préparation.");
  await mutate(game.id, async (tx) => {
    await tx.delete(killerKill).where(eq(killerKill.gameId, game.id));
    await tx.update(killerPlayer).set({ alive: true, targetId: null, killedAt: null, killedById: null }).where(eq(killerPlayer.gameId, game.id));
    await tx.update(killerGame).set({ status: "lobby", startedAt: null, endedAt: null }).where(eq(killerGame.id, game.id));
  });
  return { ok: true };
}

/** Removes the game with its players, photos and kills (cascade). */
export async function deleteGame(game: KillerGame): Promise<void> {
  await db.delete(killerGame).where(eq(killerGame.id, game.id));
  notifyGame(game.id);
}

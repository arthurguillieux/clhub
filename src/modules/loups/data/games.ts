import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { member, user, wolfCardArt, wolfGame, wolfPlayer, wolfRule, wolfSeat, type WolfGame } from "@/core/db/schema";
import { saveUpload } from "@/core/storage";
import sharp from "sharp";
import { deckEntries, deckError, draw, type Deck } from "../domain/deck";
import {
  activity,
  applyDeaths,
  isNight,
  newTracker,
  seatWon,
  noWolfDrawn,
  playerStats,
  toDay,
  toNight,
  dawn,
  type Death,
  type Seat,
  type Tracker,
  type Winner,
} from "../domain/game";
import { ROLES, isRoleId, roleName, type RoleId } from "../domain/roles";
import type { HostView, PlayerView, ScreenView } from "../views";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export const gameLink = (token: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/loups/partie/${token}`;

// ───────── Reading ─────────

export async function getGameByCode(code: string): Promise<WolfGame | null> {
  const [row] = await db.select().from(wolfGame).where(eq(wolfGame.code, code.trim().toUpperCase())).limit(1);
  return row ?? null;
}

export async function getGameByToken(token: string): Promise<WolfGame | null> {
  if (!/^[\w-]{16,64}$/.test(token)) return null;
  const [row] = await db.select().from(wolfGame).where(eq(wolfGame.token, token)).limit(1);
  return row ?? null;
}

async function loadSeats(gameId: string) {
  return db
    .select({ seat: wolfSeat, name: wolfPlayer.name })
    .from(wolfSeat)
    .innerJoin(wolfPlayer, eq(wolfPlayer.id, wolfSeat.playerId))
    .where(eq(wolfSeat.gameId, gameId))
    .orderBy(asc(wolfSeat.position));
}

const asSeat = (r: Awaited<ReturnType<typeof loadSeats>>[number]): Seat => ({
  id: r.seat.id,
  name: r.name,
  position: r.seat.position,
  role: r.seat.role && isRoleId(r.seat.role) ? r.seat.role : null,
  alive: r.seat.alive,
  diedTurn: r.seat.diedTurn,
  deathOrder: r.seat.deathOrder,
});

const trackerOf = (g: WolfGame): Tracker => ({ ...newTracker(), ...(g.state as Partial<Tracker> | null) });

/** The meneur's wording of the rules, else ours. */
export async function rulesFor(ownerId: string): Promise<Record<string, string>> {
  const rows = await db.select().from(wolfRule).where(eq(wolfRule.ownerMemberId, ownerId));
  const own = new Map(rows.map((r) => [r.roleId, r.text]));
  return Object.fromEntries(ROLES.map((r) => [r.id, own.get(r.id) ?? r.rule]));
}

export async function customRules(ownerId: string): Promise<string[]> {
  const rows = await db.select({ roleId: wolfRule.roleId }).from(wolfRule).where(eq(wolfRule.ownerMemberId, ownerId));
  return rows.map((r) => r.roleId);
}

export async function playerBook(ownerId: string) {
  return db
    .select({ id: wolfPlayer.id, name: wolfPlayer.name, memberId: wolfPlayer.memberId })
    .from(wolfPlayer)
    .where(eq(wolfPlayer.ownerMemberId, ownerId))
    .orderBy(asc(wolfPlayer.name));
}

export async function getHostView(g: WolfGame): Promise<HostView> {
  const rows = await loadSeats(g.id);
  return {
    code: g.code,
    link: gameLink(g.token),
    status: g.status as HostView["status"],
    dealMode: g.dealMode === "app" ? "app" : "cards",
    deck: g.deck as Deck,
    plague: g.plague,
    nightOrder: g.nightOrder ?? null,
    tracker: trackerOf(g),
    seats: rows.map((r) => ({ ...asSeat(r), playerId: r.seat.playerId, startRole: r.seat.startRole, cause: r.seat.deathCause, claimed: !!r.seat.claimKey, seen: !!r.seat.seenAt })),
    winner: (g.winner as Winner | null) ?? null,
    blackPlague: g.blackPlague,
    canUndo: g.history.length > 0,
    rules: await rulesFor(g.hostMemberId),
    art: await cardArt(g.hostMemberId),
    reveal: g.reveal ?? null,
  };
}

export async function getPlayerView(g: WolfGame, key: string | null): Promise<PlayerView> {
  const rows = await loadSeats(g.id);
  const rules = await rulesFor(g.hostMemberId);
  const [host] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, g.hostMemberId)).limit(1);
  const mine = key ? rows.find((r) => r.seat.claimKey === key) : undefined;
  const done = g.status === "done";
  return {
    meneur: host?.name ?? "le meneur",
    art: await cardArt(g.hostMemberId),
    status: g.status as PlayerView["status"],
    dealMode: g.dealMode === "app" ? "app" : "cards",
    players: rows.length,
    deck: deckEntries(g.deck as Deck).map((e) => ({ id: e.id, name: roleName(e.id), count: e.count, rule: rules[e.id] ?? "" })),
    seats: rows.map((r) => ({ id: r.seat.id, name: r.name, claimed: !!r.seat.claimKey })),
    me: mine
      ? { seatId: mine.seat.id, name: mine.name, role: mine.seat.startRole, roleName: roleName(mine.seat.startRole), rule: mine.seat.startRole ? (rules[mine.seat.startRole] ?? "") : "" }
      : null,
    end: done
      ? {
          winner: (g.winner as Winner | null) ?? "personne",
          blackPlague: g.blackPlague,
          seats: rows.map((r) => ({ name: r.name, role: roleName(r.seat.startRole ?? r.seat.role), alive: r.seat.alive })),
        }
      : null,
  };
}

export async function listGames(hostId: string) {
  return db
    .select({
      code: wolfGame.code,
      status: wolfGame.status,
      winner: wolfGame.winner,
      blackPlague: wolfGame.blackPlague,
      createdAt: wolfGame.createdAt,
      endedAt: wolfGame.endedAt,
      players: sql<number>`(select count(*)::int from wolf_seat s where s.game_id = "wolf_game"."id")`,
    })
    .from(wolfGame)
    .where(eq(wolfGame.hostMemberId, hostId))
    .orderBy(desc(wolfGame.createdAt))
    .limit(60);
}

/** The meneur's stats: games by winning side, and per player, how long they last. */
export async function getStats(hostId: string) {
  const games = await db
    .select({ winner: wolfGame.winner, blackPlague: wolfGame.blackPlague, state: wolfGame.state, id: wolfGame.id, startedAt: wolfGame.startedAt, endedAt: wolfGame.endedAt })
    .from(wolfGame)
    .where(and(eq(wolfGame.hostMemberId, hostId), eq(wolfGame.status, "done"), isNotNull(wolfGame.winner)));
  const byWinner: Record<string, number> = {};
  for (const g of games) byWinner[g.winner ?? "personne"] = (byWinner[g.winner ?? "personne"] ?? 0) + 1;
  const lastTurn = new Map(games.map((g) => [g.id, (g.state as Partial<Tracker> | null)?.turn ?? 1]));
  const seats =
    games.length === 0
      ? []
      : await db
          .select({ id: wolfSeat.id, gameId: wolfSeat.gameId, playerId: wolfSeat.playerId, name: wolfPlayer.name, alive: wolfSeat.alive, diedTurn: wolfSeat.diedTurn, deathOrder: wolfSeat.deathOrder, role: wolfSeat.role, position: wolfSeat.position })
          .from(wolfSeat)
          .innerJoin(wolfPlayer, eq(wolfPlayer.id, wolfSeat.playerId))
          .where(
            inArray(
              wolfSeat.gameId,
              games.map((g) => g.id),
            ),
          );
  const byGame = new Map(games.map((g) => [g.id, g]));
  const won = (s: (typeof seats)[number]) => {
    const g = byGame.get(s.gameId);
    if (!g?.winner) return false;
    const seat: Seat = { id: s.id, name: s.name, position: s.position, role: s.role && isRoleId(s.role) ? s.role : null, alive: s.alive, diedTurn: s.diedTurn, deathOrder: s.deathOrder };
    return seatWon(seat, { ...newTracker(), ...(g.state as Partial<Tracker> | null) }, g.winner as Winner);
  };
  return {
    games: games.length,
    blackPlagues: games.filter((g) => g.blackPlague).length,
    byWinner,
    activity: activity(
      games.map((g) => ({
        startedAt: g.startedAt,
        endedAt: g.endedAt,
        winner: (g.winner ?? "personne") as Winner,
        blackPlague: g.blackPlague,
        players: seats.filter((s) => s.gameId === g.id).length,
        lastTurn: lastTurn.get(g.id) ?? 1,
      })),
    ),
    players: playerStats(seats.map((s) => ({ ...s, lastTurn: lastTurn.get(s.gameId) ?? 1, won: won(s) }))),
  };
}

// ───────── The player book ─────────

/** A club member or a free first name, found in the meneur's book or added to it. */
export async function findOrAddPlayer(ownerId: string, who: { name: string } | { memberId: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if ("memberId" in who) {
    const [m] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, who.memberId)).limit(1);
    if (!m) return fail("Ce membre n'existe pas.");
    const [linked] = await db
      .select({ id: wolfPlayer.id })
      .from(wolfPlayer)
      .where(and(eq(wolfPlayer.ownerMemberId, ownerId), eq(wolfPlayer.memberId, who.memberId)))
      .limit(1);
    if (linked) return { ok: true, id: linked.id };
    const [same] = await db
      .select({ id: wolfPlayer.id })
      .from(wolfPlayer)
      .where(and(eq(wolfPlayer.ownerMemberId, ownerId), sql`lower(${wolfPlayer.name}) = lower(${m.name})`))
      .limit(1);
    if (same) {
      await db.update(wolfPlayer).set({ memberId: who.memberId }).where(eq(wolfPlayer.id, same.id));
      return { ok: true, id: same.id };
    }
    const [row] = await db.insert(wolfPlayer).values({ ownerMemberId: ownerId, name: m.name, memberId: who.memberId }).returning({ id: wolfPlayer.id });
    return row ? { ok: true, id: row.id } : fail("Impossible d'ajouter ce joueur.");
  }
  const name = who.name.replace(/\s+/g, " ").trim();
  if (!name) return fail("Il manque le prénom.");
  const [same] = await db
    .select({ id: wolfPlayer.id })
    .from(wolfPlayer)
    .where(and(eq(wolfPlayer.ownerMemberId, ownerId), sql`lower(${wolfPlayer.name}) = lower(${name})`))
    .limit(1);
  if (same) return { ok: true, id: same.id };
  const [row] = await db.insert(wolfPlayer).values({ ownerMemberId: ownerId, name }).returning({ id: wolfPlayer.id });
  return row ? { ok: true, id: row.id } : fail("Impossible d'ajouter ce joueur.");
}

// ───────── The usual table ─────────

/** Arthur's table, 95 % of the games: where a new game starts until the meneur keeps another one. */
export const DEFAULT_TABLE = ["Marine", "Vak", "Marie", "Taran", "Tanguy", "Momo", "Mélissa", "Jordan"];

/** Names match without case or accents: « melissa » is « Mélissa ». */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** The player ids of the meneur's usual table, in order (the default one, found or added to the book). */
export async function usualTable(ownerId: string): Promise<string[]> {
  const book = await db.select({ id: wolfPlayer.id, name: wolfPlayer.name, usual: wolfPlayer.usualPosition }).from(wolfPlayer).where(eq(wolfPlayer.ownerMemberId, ownerId));
  const kept = book.filter((p) => p.usual !== null).sort((a, b) => a.usual! - b.usual!);
  if (kept.length) return kept.map((p) => p.id);
  const ids: string[] = [];
  for (const name of DEFAULT_TABLE) {
    const known = book.find((p) => fold(p.name) === fold(name));
    if (known) ids.push(known.id);
    else {
      const added = await findOrAddPlayer(ownerId, { name });
      if (added.ok) ids.push(added.id);
    }
  }
  return ids;
}

/** « Garder cette table par défaut »: the next new games start with it. */
export async function saveUsualTable(ownerId: string, playerIds: string[]): Promise<Result> {
  await db.transaction(async (tx) => {
    await tx.update(wolfPlayer).set({ usualPosition: null }).where(eq(wolfPlayer.ownerMemberId, ownerId));
    for (const [i, id] of playerIds.entries()) await tx.update(wolfPlayer).set({ usualPosition: i }).where(and(eq(wolfPlayer.id, id), eq(wolfPlayer.ownerMemberId, ownerId)));
  });
  return { ok: true };
}

// ───────── The card pictures ─────────

/** « verso » and the role ids: what a meneur can upload a picture for. */
export const CARD_FACES = ["verso", ...ROLES.map((r) => r.id)] as const;

/** The meneur's own pictures of their cards, by face. */
export async function cardArt(ownerId: string): Promise<Record<string, string>> {
  const rows = await db.select({ face: wolfCardArt.face, path: wolfCardArt.path }).from(wolfCardArt).where(eq(wolfCardArt.ownerMemberId, ownerId));
  return Object.fromEntries(rows.map((r) => [r.face, r.path]));
}

/** A card picture, resized and kept on the NAS (never sent anywhere else). */
export async function saveCardArt(ownerId: string, face: string, file: Buffer): Promise<Result> {
  if (!(CARD_FACES as readonly string[]).includes(face)) return fail("Cette carte n'existe pas.");
  let data: Buffer;
  try {
    data = await sharp(file).rotate().resize({ width: 720, height: 1008, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  } catch {
    return fail("Ce fichier n'est pas une image lisible.");
  }
  const path = await saveUpload("loups", `${face}-${randomBytes(12).toString("hex")}.webp`, data);
  await db
    .insert(wolfCardArt)
    .values({ ownerMemberId: ownerId, face, path })
    .onConflictDoUpdate({ target: [wolfCardArt.ownerMemberId, wolfCardArt.face], set: { path, createdAt: new Date() } });
  return { ok: true };
}

export async function deleteCardArt(ownerId: string, face: string): Promise<Result> {
  await db.delete(wolfCardArt).where(and(eq(wolfCardArt.ownerMemberId, ownerId), eq(wolfCardArt.face, face)));
  return { ok: true };
}

// ───────── Setting up ─────────

async function newCode(): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: wolfGame.id }).from(wolfGame).where(eq(wolfGame.code, code)).limit(1);
    if (!taken) return code;
  }
}

/** A new game: blank, or the same table and deck as `from` (« Rejouer », « Ajuster le deck »). */
export async function createGame(hostId: string, from: WolfGame | null): Promise<WolfGame> {
  if (!from) {
    // The settings of last time (deal, peste noire, night order), and the usual table.
    const [last] = await db.select().from(wolfGame).where(eq(wolfGame.hostMemberId, hostId)).orderBy(desc(wolfGame.createdAt)).limit(1);
    const created = await insertGame(hostId, last ?? null);
    await db.update(wolfGame).set({ deck: {}, previousGameId: null }).where(eq(wolfGame.id, created.id));
    await db.delete(wolfSeat).where(eq(wolfSeat.gameId, created.id));
    const table = await usualTable(hostId);
    if (table.length) await db.insert(wolfSeat).values(table.map((playerId, position) => ({ gameId: created.id, playerId, position })));
    return { ...created, deck: {}, previousGameId: null };
  }
  return insertGame(hostId, from);
}

async function insertGame(hostId: string, from: WolfGame | null): Promise<WolfGame> {
  const [game] = await db
    .insert(wolfGame)
    .values({
      code: await newCode(),
      token: randomBytes(24).toString("base64url"),
      hostMemberId: hostId,
      dealMode: from?.dealMode ?? "cards",
      deck: from?.deck ?? {},
      plague: from?.plague ?? true,
      nightOrder: from?.nightOrder ?? null,
      previousGameId: from?.id ?? null,
    })
    .returning();
  if (!game) throw new Error("wolf game not created");
  if (from) {
    const seats = await db.select({ playerId: wolfSeat.playerId, position: wolfSeat.position }).from(wolfSeat).where(eq(wolfSeat.gameId, from.id)).orderBy(asc(wolfSeat.position));
    if (seats.length) await db.insert(wolfSeat).values(seats.map((s) => ({ gameId: game.id, playerId: s.playerId, position: s.position })));
  }
  return game;
}

export async function saveSetup(g: WolfGame, s: { playerIds: string[]; deck: Deck; plague: boolean; dealMode: "cards" | "app" }): Promise<Result> {
  if (g.status !== "setup") return fail("La partie est déjà lancée.");
  const ids = [...new Set(s.playerIds)];
  if (ids.length) {
    const own = await db
      .select({ id: wolfPlayer.id })
      .from(wolfPlayer)
      .where(and(eq(wolfPlayer.ownerMemberId, g.hostMemberId), inArray(wolfPlayer.id, ids)));
    if (own.length !== ids.length) return fail("Un des joueurs n'est pas dans ton carnet.");
  }
  await db.transaction(async (tx) => {
    await tx.update(wolfGame).set({ deck: s.deck, plague: s.plague, dealMode: s.dealMode }).where(eq(wolfGame.id, g.id));
    await tx.delete(wolfSeat).where(eq(wolfSeat.gameId, g.id));
    if (ids.length) await tx.insert(wolfSeat).values(ids.map((playerId, position) => ({ gameId: g.id, playerId, position })));
  });
  return { ok: true };
}

/** The cards are dealt (by the CLHUB) or about to be (a real deck): the first night is near. */
export async function launch(g: WolfGame): Promise<Result> {
  if (g.status !== "setup") return fail("La partie est déjà lancée.");
  const seats = await db.select({ id: wolfSeat.id }).from(wolfSeat).where(eq(wolfSeat.gameId, g.id)).orderBy(asc(wolfSeat.position));
  const error = deckError(g.deck as Deck, seats.length);
  if (error) return fail(error);
  const app = g.dealMode === "app";
  const cards = app ? draw(g.deck as Deck, seats.length, () => randomInt(1_000_000) / 1_000_000) : [];
  await db.transaction(async (tx) => {
    for (const [i, s] of seats.entries()) {
      const role = cards[i] ?? null;
      await tx.update(wolfSeat).set({ role, startRole: role, alive: true, diedTurn: null, deathOrder: null, deathCause: null, claimKey: null, seenAt: null }).where(eq(wolfSeat.id, s.id));
    }
    await tx
      .update(wolfGame)
      // No wolf among the cards dealt: « peste noire » from the first night, the meneur kills.
      .set({
        status: app ? "dealing" : "playing",
        state: { ...newTracker(), plague: app && !cards.some((c) => c === "loup" || c === "infect" || c === "loupblanc") } as unknown as Record<string, unknown>,
        history: [],
        startedAt: new Date(),
      })
      .where(eq(wolfGame.id, g.id));
  });
  return { ok: true };
}

/** Everyone has their card: the first night falls. */
export async function startNight(g: WolfGame): Promise<Result> {
  if (g.status !== "dealing") return { ok: true };
  await db.update(wolfGame).set({ status: "playing" }).where(eq(wolfGame.id, g.id));
  return { ok: true };
}

export async function markSeen(g: WolfGame, seatId: string, seen: boolean): Promise<Result> {
  await db
    .update(wolfSeat)
    .set({ seenAt: seen ? new Date() : null, ...(seen ? {} : { claimKey: null }) })
    .where(and(eq(wolfSeat.id, seatId), eq(wolfSeat.gameId, g.id)));
  return { ok: true };
}

export async function saveRule(ownerId: string, roleId: string, text: string | null): Promise<Result> {
  if (!isRoleId(roleId)) return fail("Ce rôle n'existe pas.");
  const clean = text?.trim() ?? "";
  const original = ROLES.find((r) => r.id === roleId)?.rule;
  if (!clean || clean === original) {
    await db.delete(wolfRule).where(and(eq(wolfRule.ownerMemberId, ownerId), eq(wolfRule.roleId, roleId)));
    return { ok: true };
  }
  await db
    .insert(wolfRule)
    .values({ ownerMemberId: ownerId, roleId, text: clean })
    .onConflictDoUpdate({ target: [wolfRule.ownerMemberId, wolfRule.roleId], set: { text: clean } });
  return { ok: true };
}

export async function deleteGame(g: WolfGame): Promise<void> {
  await db.delete(wolfGame).where(eq(wolfGame.id, g.id));
}

// ───────── Playing ─────────

/** A death, with the card it turned over when the meneur didn't know it yet. */
export type Reveal = Death & { role?: RoleId };

export type Command =
  | { t: "assign"; seat: string; role: RoleId }
  | { t: "step"; step: string; done: boolean }
  | { t: "lovers"; a: string; b: string }
  | { t: "model"; seat: string }
  | { t: "protect"; seat: string | null }
  | { t: "victim"; seat: string | null }
  | { t: "wolves"; seats: string[] }
  | { t: "plague"; on: boolean }
  | { t: "infect"; on: boolean }
  | { t: "whiteWolf"; seat: string | null }
  | { t: "witch"; heal: boolean; poison: string | null }
  | { t: "dawn"; deaths: Reveal[] }
  | { t: "barber"; barber: string; deaths: Reveal[] }
  | { t: "vote"; target: string | null; spared: boolean; servant: string | null; deaths: Reveal[] }
  | { t: "judge" }
  | { t: "kill"; deaths: Reveal[] }
  | { t: "dusk" }
  | { t: "order"; order: string[] }
  | { t: "undo" };

interface Snapshot {
  state: Tracker;
  seats: { id: string; role: string | null; alive: boolean; diedTurn: number | null; deathOrder: number | null; deathCause: string | null }[];
}

/** One move of the meneur. Everything but ticking a step can be undone. */
export async function play(g: WolfGame, c: Command): Promise<Result> {
  if (g.status !== "playing") return fail("La partie n'est pas en cours.");
  const rows = await loadSeats(g.id);
  let seats = rows.map(asSeat);
  let t = trackerOf(g);
  const has = (id: string | null) => id === null || seats.some((s) => s.id === id);
  const name = (id: string) => seats.find((s) => s.id === id)?.name ?? "?";
  const log = (text: string) => (t = { ...t, log: [...t.log, { turn: t.turn, text }] });

  if (c.t === "order") {
    await db.update(wolfGame).set({ nightOrder: c.order }).where(eq(wolfGame.id, g.id));
    return { ok: true };
  }
  if (c.t === "undo") {
    const history = g.history as Snapshot[];
    const last = history.at(-1);
    if (!last) return fail("Rien à annuler.");
    await db.transaction(async (tx) => {
      for (const s of last.seats) await tx.update(wolfSeat).set({ role: s.role, alive: s.alive, diedTurn: s.diedTurn, deathOrder: s.deathOrder, deathCause: s.deathCause }).where(eq(wolfSeat.id, s.id));
      await tx
        .update(wolfGame)
        .set({ state: last.state as unknown as Record<string, unknown>, history: history.slice(0, -1) })
        .where(eq(wolfGame.id, g.id));
    });
    return { ok: true };
  }

  const snapshot: Snapshot = {
    state: t,
    seats: rows.map((r) => ({ id: r.seat.id, role: r.seat.role, alive: r.seat.alive, diedTurn: r.seat.diedTurn, deathOrder: r.seat.deathOrder, deathCause: r.seat.deathCause })),
  };
  const causes = new Map<string, string>();
  const kill = (deaths: Reveal[]) => {
    // With real cards, a card is turned over when its player dies.
    seats = seats.map((s) => {
      const role = deaths.find((d) => d.seat === s.id)?.role;
      return role && s.role === null ? { ...s, role } : s;
    });
    const alive = deaths.filter((d) => seats.find((s) => s.id === d.seat)?.alive);
    for (const d of alive) causes.set(d.seat, d.cause);
    ({ seats, tracker: t } = applyDeaths(seats, t, alive));
  };
  const night = t.turn % 2 === 1;

  switch (c.t) {
    case "assign":
      if (!has(c.seat)) return fail("Joueur inconnu.");
      seats = seats.map((s) => (s.id === c.seat ? { ...s, role: c.role } : s));
      break;
    case "step":
      t = { ...t, tonight: { ...t.tonight, done: c.done ? [...new Set([...t.tonight.done, c.step])] : t.tonight.done.filter((d) => d !== c.step) } };
      break;
    case "lovers":
      if (!has(c.a) || !has(c.b) || c.a === c.b) return fail("Choisis deux joueurs différents.");
      t = { ...t, lovers: [c.a, c.b] };
      log(`${name(c.a)} et ${name(c.b)} sont amoureux.`);
      break;
    case "model":
      if (!has(c.seat)) return fail("Joueur inconnu.");
      t = { ...t, model: c.seat };
      log(`L'enfant sauvage a choisi ${name(c.seat)} pour modèle.`);
      break;
    case "protect":
      if (!has(c.seat)) return fail("Joueur inconnu.");
      if (c.seat && c.seat === t.lastProtected) return fail("Le salvateur ne peut pas protéger deux nuits de suite le même joueur.");
      t = { ...t, tonight: { ...t.tonight, protected: c.seat } };
      break;
    case "victim":
      if (!has(c.seat)) return fail("Joueur inconnu.");
      t = { ...t, tonight: { ...t.tonight, victim: c.seat } };
      break;
    case "wolves":
      seats = seats.map((s) => (c.seats.includes(s.id) && s.role === null ? { ...s, role: "loup" } : s));
      break;
    case "plague":
      t = { ...t, plague: c.on };
      if (c.on) log("Personne ne se réveille à l'appel des loups : peste noire, c'est le meneur qui tue.");
      break;
    case "infect":
      t = { ...t, tonight: { ...t.tonight, infect: c.on } };
      break;
    case "whiteWolf":
      t = { ...t, tonight: { ...t.tonight, whiteWolf: c.seat } };
      break;
    case "witch":
      if (c.heal && t.used.heal) return fail("La potion de vie a déjà servi.");
      if (c.poison && t.used.poison) return fail("La potion de mort a déjà servi.");
      t = { ...t, tonight: { ...t.tonight, heal: c.heal, poison: c.poison } };
      break;
    case "dawn": {
      if (!night) return fail("C'est déjà le jour.");
      const d = dawn(seats, t);
      // What the night did first, then who it killed: the deaths keep the night's turn.
      const nightTurn = t.turn;
      t = { ...toDay(t, d, seats), turn: nightTurn };
      kill(c.deaths);
      t = { ...t, turn: nightTurn + 1 };
      if (c.deaths.length === 0) log("Personne n'est mort cette nuit.");
      break;
    }
    case "barber":
      if (night) return fail("Le barbier frappe de jour.");
      t = { ...t, used: { ...t.used, barbier: true } };
      log(`Le barbier ${name(c.barber)} se dévoile et frappe.`);
      kill(c.deaths);
      break;
    case "vote":
      if (night) return fail("Le village vote de jour.");
      if (c.target === null) log("Le village n'a éliminé personne.");
      else if (c.spared) {
        t = { ...t, idiotSpared: true };
        log(`${name(c.target)} est l'idiot du village : gracié, il ne vote plus.`);
      } else {
        if (c.servant) {
          const role = seats.find((s) => s.id === c.target)?.role ?? null;
          seats = seats.map((s) => (s.id === c.servant ? { ...s, role } : s));
          t = { ...t, used: { ...t.used, servante: true } };
          log(`La servante ${name(c.servant)} prend la carte de ${name(c.target)} : ${roleName(role)}.`);
        }
        kill(c.deaths);
      }
      break;
    case "judge":
      t = { ...t, used: { ...t.used, juge: true } };
      log("Le juge demande un second vote.");
      break;
    case "kill":
      kill(c.deaths);
      break;
    case "dusk":
      if (night) return fail("C'est déjà la nuit.");
      t = toNight(t);
      break;
  }

  const keep = c.t !== "step";
  await db.transaction(async (tx) => {
    for (const s of seats) {
      const before = rows.find((r) => r.seat.id === s.id)?.seat;
      if (!before) continue;
      if (before.role !== s.role || before.alive !== s.alive || before.diedTurn !== s.diedTurn || before.deathOrder !== s.deathOrder || causes.has(s.id)) {
        await tx
          .update(wolfSeat)
          // With real cards, the card first named for a seat is the one it was dealt.
          .set({ role: s.role, startRole: before.startRole ?? (before.role === null ? s.role : null), alive: s.alive, diedTurn: s.diedTurn, deathOrder: s.deathOrder, deathCause: causes.get(s.id) ?? before.deathCause })
          .where(eq(wolfSeat.id, s.id));
      }
    }
    await tx
      .update(wolfGame)
      .set({ state: t as unknown as Record<string, unknown>, ...(keep ? { history: [...(g.history as Snapshot[]), snapshot].slice(-40) } : {}) })
      .where(eq(wolfGame.id, g.id));
  });
  return { ok: true };
}

/** The meneur ends the game, the winning side chosen (or confirmed). */
export async function endGame(g: WolfGame, winner: Winner, blackPlague: boolean): Promise<Result> {
  if (g.status !== "playing" && g.status !== "dealing") return fail("La partie n'est pas en cours.");
  await db.update(wolfGame).set({ status: "done", winner, blackPlague, endedAt: new Date() }).where(eq(wolfGame.id, g.id));
  return { ok: true };
}

/** For the meneur who deals with the CLHUB: no wolf among the cards dealt. */
export async function plagueDealt(g: WolfGame): Promise<boolean> {
  if (g.dealMode !== "app") return false;
  return noWolfDrawn((await loadSeats(g.id)).map(asSeat));
}

// ───────── The players' phones ─────────

/** « C'est moi » on the game's link: the seat is this phone's, until the meneur frees it. */
export async function claimSeat(g: WolfGame, seatId: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  if (g.dealMode !== "app" || (g.status !== "dealing" && g.status !== "playing")) return fail("Le meneur distribue de vraies cartes : rien à voir ici.");
  const key = randomBytes(18).toString("base64url");
  const [row] = await db
    .update(wolfSeat)
    .set({ claimKey: key, seenAt: new Date() })
    .where(and(eq(wolfSeat.id, seatId), eq(wolfSeat.gameId, g.id), sql`${wolfSeat.claimKey} is null`))
    .returning({ id: wolfSeat.id });
  if (!row) return fail("Quelqu'un a déjà pris ce prénom. Si c'est une erreur, demande au meneur de le libérer.");
  return { ok: true, key };
}

// ───────── The reveal, and the room's screen ─────────

/** « Révéler la carte »: flipped on the meneur's phone and on the projection screen. Only when the CLHUB dealt. */
export async function revealCard(g: WolfGame, seatId: string | null): Promise<Result> {
  if (g.dealMode !== "app") return fail("Avec de vraies cartes, le joueur retourne la sienne.");
  if (seatId) {
    const [seat] = await db.select({ id: wolfSeat.id }).from(wolfSeat).where(and(eq(wolfSeat.id, seatId), eq(wolfSeat.gameId, g.id))).limit(1);
    if (!seat) return fail("Ce joueur n'est pas à la table.");
  }
  await db
    .update(wolfGame)
    .set({ reveal: seatId ? { seatId, at: Date.now() } : null })
    .where(eq(wolfGame.id, g.id));
  return { ok: true };
}

/**
 * What the room's screen shows: the table, the dead with their card, the cards still in play, the
 * time, and the reveal. Never a living player's card (unless the meneur reveals it), never the night.
 */
export async function getScreenView(g: WolfGame): Promise<ScreenView> {
  const rows = await loadSeats(g.id);
  const t = trackerOf(g);
  const app = g.dealMode === "app";
  const dead = rows.filter((r) => !r.seat.alive);
  const shownRole = (r: (typeof rows)[number]) => (r.seat.alive ? null : (r.seat.role ?? r.seat.startRole));
  // The cards still in play: the deck, minus the cards of the dead that are known.
  const left = { ...(g.deck as Deck) };
  for (const r of dead) {
    const role = shownRole(r) as RoleId | null;
    if (role && left[role]) left[role] = left[role]! - 1;
  }
  const revealRow = g.reveal ? rows.find((r) => r.seat.id === g.reveal!.seatId) : undefined;
  const revealRole = revealRow ? (revealRow.seat.role ?? revealRow.seat.startRole) : null;
  return {
    status: g.status as ScreenView["status"],
    dealMode: app ? "app" : "cards",
    link: gameLink(g.token),
    turn: t.turn,
    night: isNight(t.turn),
    startedAt: g.startedAt?.getTime() ?? null,
    endedAt: g.endedAt?.getTime() ?? null,
    now: Date.now(),
    seats: rows.map((r) => ({ id: r.seat.id, name: r.name, alive: r.seat.alive, deathOrder: r.seat.deathOrder, role: shownRole(r), roleName: shownRole(r) ? roleName(shownRole(r)) : null })),
    cardsLeft: deckEntries(left).map((e) => ({ id: e.id, name: roleName(e.id), count: e.count })),
    spare: Math.max(0, Object.values(left).reduce((s, n) => s + (n ?? 0), 0) - rows.filter((r) => r.seat.alive).length),
    winner: g.status === "done" ? ((g.winner as Winner | null) ?? "personne") : null,
    art: await cardArt(g.hostMemberId),
    reveal: g.reveal && revealRow && revealRole ? { seatId: revealRow.seat.id, name: revealRow.name, role: revealRole, roleName: roleName(revealRole), at: g.reveal.at } : null,
  };
}

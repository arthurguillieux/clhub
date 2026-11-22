import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/db/client";
import { member, scenarioAction, scenarioCohost, scenarioGame, scenarioUnlock, user, type ScenarioGame } from "@/core/db/schema";
import { notifyGame } from "@/modules/killer/data/notifier";
import { initialState, missedClues, recap, replay, suggestedWinner, type Action, type Setup, type State } from "./engine";
import { checkPassword, scenarioOf } from "./index";
import type { ScenarioDef } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export const projectionLink = (token: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/scenario/projection/${token}`;

/** A projection that hasn't asked for news in this long is shown as disconnected on the console. */
const PROJECTION_TIMEOUT_MS = 15_000;

// ───────── Unlocking ─────────

export async function unlockedScenarios(memberId: string): Promise<string[]> {
  const rows = await db.select({ id: scenarioUnlock.scenarioId }).from(scenarioUnlock).where(eq(scenarioUnlock.memberId, memberId));
  return rows.map((r) => r.id);
}

export async function unlock(memberId: string, def: ScenarioDef, password: string): Promise<Result> {
  if (!checkPassword(def, password)) return fail("Ce n'est pas le bon mot de passe.");
  await db.insert(scenarioUnlock).values({ memberId, scenarioId: def.id }).onConflictDoNothing();
  return { ok: true };
}

// ───────── Games ─────────

export async function getByCode(code: string): Promise<ScenarioGame | null> {
  const [row] = await db.select().from(scenarioGame).where(eq(scenarioGame.code, code.trim().toUpperCase())).limit(1);
  return row ?? null;
}

export async function getByToken(token: string): Promise<ScenarioGame | null> {
  if (!/^[\w-]{16,64}$/.test(token)) return null;
  const [row] = await db.select().from(scenarioGame).where(eq(scenarioGame.token, token)).limit(1);
  return row ?? null;
}

export type ConsoleCheck = { ok: true; game: ScenarioGame; def: ScenarioDef; memberId: string; role: "host" | "cohost" } | { ok: false; reason: "signed-out" | "missing" | "not-meneur" };

/** The console: the creator of the evening, or a co-organizer they added. No admin bypass. */
export async function checkConsole(code: string): Promise<ConsoleCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  const game = await getByCode(code);
  const def = game ? scenarioOf(game.scenarioId) : null;
  if (!game || !def) return { ok: false, reason: "missing" };
  if (game.hostMemberId === session.member.id) return { ok: true, game, def, memberId: session.member.id, role: "host" };
  const [co] = await db
    .select({ id: scenarioCohost.id })
    .from(scenarioCohost)
    .where(and(eq(scenarioCohost.gameId, game.id), eq(scenarioCohost.memberId, session.member.id)))
    .limit(1);
  return co ? { ok: true, game, def, memberId: session.member.id, role: "cohost" } : { ok: false, reason: "not-meneur" };
}

export async function listEvenings(memberId: string) {
  const cohosted = db.select({ id: scenarioCohost.gameId }).from(scenarioCohost).where(eq(scenarioCohost.memberId, memberId));
  return db
    .select({ code: scenarioGame.code, scenarioId: scenarioGame.scenarioId, status: scenarioGame.status, createdAt: scenarioGame.createdAt, setup: scenarioGame.setup })
    .from(scenarioGame)
    .where(or(eq(scenarioGame.hostMemberId, memberId), inArray(scenarioGame.id, cohosted)))
    .orderBy(desc(scenarioGame.createdAt))
    .limit(30);
}

const setupOf = (g: ScenarioGame, def: ScenarioDef): Setup => {
  const s = g.setup as Partial<Setup>;
  return { players: s.players ?? [], params: { ...def.defaults, ...s.params }, events: s.events ?? def.events, extraFaults: s.extraFaults ?? [] };
};

async function newCode(): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: scenarioGame.id }).from(scenarioGame).where(eq(scenarioGame.code, code)).limit(1);
    if (!taken) return code;
  }
}

/** A new evening, blank or « Rejouer ce scénario » (same players, parameters, events, faults, team). */
export async function createEvening(hostId: string, def: ScenarioDef, from: ScenarioGame | null): Promise<ScenarioGame> {
  const setup: Setup = from ? setupOf(from, def) : { players: [], params: def.defaults, events: def.events, extraFaults: [] };
  const [game] = await db
    .insert(scenarioGame)
    .values({ code: await newCode(), token: randomBytes(24).toString("base64url"), scenarioId: def.id, hostMemberId: hostId, setup: setup as unknown as Record<string, unknown>, previousGameId: from?.id ?? null })
    .returning();
  if (!game) throw new Error("scenario game not created");
  if (from) {
    const team = await db.select({ memberId: scenarioCohost.memberId }).from(scenarioCohost).where(eq(scenarioCohost.gameId, from.id));
    const ids = [...team.map((t) => t.memberId), from.hostMemberId].filter((id) => id !== hostId);
    if (ids.length) await db.insert(scenarioCohost).values(ids.map((memberId) => ({ gameId: game.id, memberId }))).onConflictDoNothing();
  }
  return game;
}

const bump = async (g: ScenarioGame) => {
  await db
    .update(scenarioGame)
    .set({ version: sql`${scenarioGame.version} + 1` })
    .where(eq(scenarioGame.id, g.id));
  notifyGame(g.id);
};

export async function saveSetup(g: ScenarioGame, setup: Setup): Promise<Result> {
  if (g.status !== "setup") return fail("La soirée est lancée : les joueurs et les réglages ne changent plus.");
  const names = setup.players.map((p) => p.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return fail("Deux joueurs portent le même prénom : ajoute une initiale.");
  await db
    .update(scenarioGame)
    .set({ setup: setup as unknown as Record<string, unknown> })
    .where(eq(scenarioGame.id, g.id));
  await bump(g);
  return { ok: true };
}

export async function launch(g: ScenarioGame, def: ScenarioDef): Promise<Result> {
  if (g.status !== "setup") return { ok: true };
  if (setupOf(g, def).players.length < 4) return fail("Il faut au moins 4 joueurs.");
  await db.update(scenarioGame).set({ status: "live", startedAt: new Date() }).where(eq(scenarioGame.id, g.id));
  await bump(g);
  return { ok: true };
}

export async function finish(g: ScenarioGame): Promise<Result> {
  await db.update(scenarioGame).set({ status: "done", endedAt: new Date() }).where(eq(scenarioGame.id, g.id));
  await bump(g);
  return { ok: true };
}

export async function deleteEvening(g: ScenarioGame): Promise<void> {
  await db.delete(scenarioGame).where(eq(scenarioGame.id, g.id));
  notifyGame(g.id);
}

export async function setCohost(g: ScenarioGame, memberId: string, on: boolean): Promise<Result> {
  if (memberId === g.hostMemberId) return fail("Tu mènes déjà cette soirée.");
  if (on) await db.insert(scenarioCohost).values({ gameId: g.id, memberId }).onConflictDoNothing();
  else await db.delete(scenarioCohost).where(and(eq(scenarioCohost.gameId, g.id), eq(scenarioCohost.memberId, memberId)));
  return { ok: true };
}

export async function cohostsOf(g: ScenarioGame) {
  return db
    .select({ memberId: scenarioCohost.memberId, name: user.name })
    .from(scenarioCohost)
    .innerJoin(member, eq(member.id, scenarioCohost.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(scenarioCohost.gameId, g.id));
}

// ───────── The journal ─────────

async function journal(g: ScenarioGame) {
  return db.select().from(scenarioAction).where(eq(scenarioAction.gameId, g.id)).orderBy(asc(scenarioAction.seq));
}

const stateOf = (def: ScenarioDef, setup: Setup, rows: Awaited<ReturnType<typeof journal>>) =>
  replay(
    def,
    setup,
    rows.map((r) => ({ action: r.action as unknown as Action, at: r.createdAt.getTime() })),
  );

export async function act(g: ScenarioGame, action: Action): Promise<Result> {
  if (g.status !== "live") return fail("La soirée n'est pas lancée.");
  await db.insert(scenarioAction).values({ gameId: g.id, action: action as unknown as Record<string, unknown> });
  await bump(g);
  return { ok: true };
}

export async function undo(g: ScenarioGame): Promise<Result> {
  const [last] = await db.select({ seq: scenarioAction.seq }).from(scenarioAction).where(eq(scenarioAction.gameId, g.id)).orderBy(desc(scenarioAction.seq)).limit(1);
  if (!last) return fail("Rien à annuler.");
  await db.delete(scenarioAction).where(eq(scenarioAction.seq, last.seq));
  await bump(g);
  return { ok: true };
}

// ───────── Views ─────────

export interface ConsoleView {
  code: string;
  link: string;
  status: "setup" | "live" | "done";
  role: "host" | "cohost";
  setup: Setup;
  state: State;
  canUndo: boolean;
  projection: { connected: boolean; mediaReady: number; mediaTotal: number; mic: boolean };
  suggested: "village" | "meute" | null;
  clues: { at: string; text: string }[];
  recap: ReturnType<typeof recap>;
  cohosts: { memberId: string; name: string }[];
}

export async function getConsoleView(g: ScenarioGame, def: ScenarioDef, role: "host" | "cohost"): Promise<ConsoleView> {
  const setup = setupOf(g, def);
  const rows = await journal(g);
  const state = g.status === "setup" ? initialState(def, setup) : stateOf(def, setup, rows);
  return {
    code: g.code,
    link: projectionLink(g.token),
    status: g.status as ConsoleView["status"],
    role,
    setup,
    state,
    canUndo: rows.length > 0 && g.status === "live",
    projection: {
      connected: !!g.projectionSeenAt && Date.now() - g.projectionSeenAt.getTime() < PROJECTION_TIMEOUT_MS,
      mediaReady: g.mediaReady,
      mediaTotal: g.mediaTotal,
      mic: g.micReady,
    },
    suggested: suggestedWinner(state),
    clues: missedClues(def, setup, state),
    recap: recap(state),
    cohosts: await cohostsOf(g),
  };
}

/** What the room may see: no camp, no night secret. The faults read a little more, on purpose. */
export interface ProjectionView {
  version: number;
  status: "setup" | "live" | "done";
  scenarioId: string;
  players: { id: string; name: string; room: number; status: "alive" | "dead" | "exiled" }[];
  state: Omit<State, "players" | "tonight" | "patientZero" | "log" | "items"> & { lastExiled: string | null; lastEvent: string | null };
  /** The last actions, for effects played once (a glitch, a sound, a refused door…). */
  recent: { seq: number; at: number; action: Action }[];
  clues: { at: string; text: string }[];
  /** The day events and the organizer's own faults, to show them. */
  events: Setup["events"];
  extraFaults: Setup["extraFaults"];
  /** Server time, to time the gauge. */
  now: number;
}

export async function getProjectionView(g: ScenarioGame, def: ScenarioDef): Promise<ProjectionView> {
  const setup = setupOf(g, def);
  const rows = await journal(g);
  const full = g.status === "setup" ? initialState(def, setup) : stateOf(def, setup, rows);
  const { players, tonight, patientZero, log, items, ...rest } = full;
  void tonight;
  void patientZero;
  void items;
  const exiled = [...log].reverse().find((l) => l.text.startsWith("Exil :") && !l.text.includes("personne"));
  return {
    version: g.version,
    status: g.status as ProjectionView["status"],
    scenarioId: def.id,
    players: players.map((p) => ({ id: p.id, name: p.name, room: p.room, status: p.status })),
    state: {
      ...rest,
      lastExiled: exiled ? exiled.text.replace(/^Exil : /, "").replace(/ \(.*$/, "") : null,
      lastEvent: setup.events.find((e) => e.id === full.event)?.name ?? null,
    },
    recent: rows.slice(-12).map((r) => ({ seq: r.seq, at: r.createdAt.getTime(), action: r.action as unknown as Action })),
    clues: full.phase === "bad" ? missedClues(def, setup, full) : [],
    events: setup.events,
    extraFaults: setup.extraFaults,
    now: Date.now(),
  };
}

/** The projection computer checks in: alive, its media, its microphone. */
export async function reportProjection(g: ScenarioGame, report: { ready: number; total: number; mic: boolean }): Promise<void> {
  await db
    .update(scenarioGame)
    .set({ projectionSeenAt: new Date(), mediaReady: report.ready, mediaTotal: report.total, micReady: report.mic })
    .where(eq(scenarioGame.id, g.id));
}

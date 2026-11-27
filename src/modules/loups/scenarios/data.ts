import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/db/client";
import { member, scenarioAction, scenarioCohost, scenarioGame, scenarioUnlock, user, type ScenarioGame } from "@/core/db/schema";
import { notifyGame } from "@/modules/killer/data/notifier";
import { apply, initialState, missedClues, momentOf, protocolOf, recap, replay, suggestedWinner, type Action, type Setup, type State } from "./engine";
import { simulatedJournal, simulatedPlayers, type StartPoint } from "./simulate";
import { checkPassword, scenarioOf } from "./index";
import { publicRecent, publicState, type PublicState } from "./public";
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
    .select({ code: scenarioGame.code, token: scenarioGame.token, scenarioId: scenarioGame.scenarioId, status: scenarioGame.status, simulated: scenarioGame.simulated, createdAt: scenarioGame.createdAt, setup: scenarioGame.setup })
    .from(scenarioGame)
    .where(or(eq(scenarioGame.hostMemberId, memberId), inArray(scenarioGame.id, cohosted)))
    .orderBy(desc(scenarioGame.createdAt))
    .limit(30);
}

/**
 * The station this member already has open for this scenario (the latest real one, not finished):
 * « Ouvrir la station » goes back to it, so the phone and the projection computer meet on the same one.
 */
export async function openStation(memberId: string, scenarioId: string): Promise<ScenarioGame | null> {
  const cohosted = db.select({ id: scenarioCohost.gameId }).from(scenarioCohost).where(eq(scenarioCohost.memberId, memberId));
  const [row] = await db
    .select()
    .from(scenarioGame)
    .where(
      and(
        eq(scenarioGame.scenarioId, scenarioId),
        eq(scenarioGame.simulated, false),
        inArray(scenarioGame.status, ["setup", "live"]),
        or(eq(scenarioGame.hostMemberId, memberId), inArray(scenarioGame.id, cohosted)),
      ),
    )
    .orderBy(desc(scenarioGame.createdAt))
    .limit(1);
  return row ?? null;
}

const setupOf = (g: ScenarioGame, def: ScenarioDef): Setup => {
  const s = g.setup as Partial<Setup>;
  return { players: s.players ?? [], params: { ...def.defaults, ...s.params }, events: s.events ?? def.events, extraFaults: s.extraFaults ?? [], files: s.files ?? {}, dates: s.dates ?? {}, texts: s.texts ?? {} };
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
  const setup: Setup = from ? setupOf(from, def) : { players: [], params: def.defaults, events: def.events, extraFaults: [], files: {}, dates: {} };
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
  const def = scenarioOf(g.scenarioId);
  if (def && (await currentState(g, def)).loadingAt !== null) return fail("Le scénario est chargé : retire-le pour changer la préparation.");
  const names = setup.players.map((p) => p.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return fail("Deux joueurs portent le même prénom : ajoute une initiale.");
  await db
    .update(scenarioGame)
    .set({ setup: setup as unknown as Record<string, unknown> })
    .where(eq(scenarioGame.id, g.id));
  await bump(g);
  return { ok: true };
}

/** « Lancer la partie »: the scenario loaded into the station starts (the prologue of the bus). */
export async function launch(g: ScenarioGame, def: ScenarioDef): Promise<Result> {
  if (g.status !== "setup") return { ok: true };
  if (setupOf(g, def).players.length < 4) return fail("Il faut au moins 4 joueurs.");
  if (protocolOf(await currentState(g, def), Date.now()) !== "ready") return fail("Le scénario n'est pas encore chargé.");
  await db.update(scenarioGame).set({ status: "live", startedAt: new Date() }).where(eq(scenarioGame.id, g.id));
  await db.insert(scenarioAction).values({ gameId: g.id, action: { t: "start" } });
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

/** The station's state now, from its journal. */
async function currentState(g: ScenarioGame, def: ScenarioDef): Promise<State> {
  return stateOf(def, setupOf(g, def), await journal(g));
}

/** The game's own moves wait for « Lancer la partie »; before it, the station is piloted on its own. */
const GAME_ONLY = new Set<Action["t"]>(["start", "reveal", "arrive", "patientZero", "night", "panic", "tapes", "infect", "victim", "useItem", "giveItem", "propose", "deadChoose", "skip", "dawn", "exile", "setInfected", "endLoop", "reboot", "goodEnd", "badEnd", "vote", "voteResult", "dayAction", "labForce", "chief", "chiefConfirm", "shoot", "bloodTest", "radio", "quarantine", "confinement", "flag", "jump", "kill", "revive"]);

export async function act(g: ScenarioGame, action: Action): Promise<Result> {
  if (g.status === "done") return fail("La soirée est terminée.");
  if (g.status === "setup" && GAME_ONLY.has(action.t)) return fail("Lance d'abord la partie.");
  if (action.t === "load") {
    const def = scenarioOf(g.scenarioId);
    if (def && setupOf(g, def).players.length < 4) return fail("Il faut au moins 4 joueurs pour charger le scénario.");
  }
  await db.insert(scenarioAction).values({ gameId: g.id, action: action as unknown as Record<string, unknown> });
  await bump(g);
  return { ok: true };
}

/** « Revenir à »: the journal is cut just after this action, as if what followed never happened. */
export async function rewind(g: ScenarioGame, seq: number): Promise<Result> {
  if (g.status !== "live") return fail("La soirée n'est pas en cours.");
  await db.delete(scenarioAction).where(and(eq(scenarioAction.gameId, g.id), sql`${scenarioAction.seq} > ${seq}`));
  await bump(g);
  return { ok: true };
}

/**
 * Whose gestures « Annuler » takes back: one's own only, so that two consoles never undo each other
 * (Arthur's vote is not Rémi's wind). The journal's older rows, written before the authors were noted,
 * are the creator's.
 */
const mine = (memberId: string, role: "host" | "cohost") =>
  role === "host" ? sql`(${scenarioAction.action}->>'by' = ${memberId} or ${scenarioAction.action}->>'by' is null)` : sql`${scenarioAction.action}->>'by' = ${memberId}`;

export async function undo(g: ScenarioGame, memberId: string, role: "host" | "cohost"): Promise<Result> {
  if (g.status === "done") return fail("La soirée est terminée.");
  const [last] = await db
    .select({ seq: scenarioAction.seq })
    .from(scenarioAction)
    .where(and(eq(scenarioAction.gameId, g.id), mine(memberId, role)))
    .orderBy(desc(scenarioAction.seq))
    .limit(1);
  if (!last) return fail("Rien à annuler de ton côté.");
  await db.delete(scenarioAction).where(eq(scenarioAction.seq, last.seq));
  await bump(g);
  return { ok: true };
}

// ───────── Views ─────────

export interface ConsoleView {
  code: string;
  link: string;
  status: "setup" | "live" | "done";
  simulated: boolean;
  role: "host" | "cohost";
  setup: Setup;
  state: State;
  /** Whether this console has a gesture of its own to take back. */
  canUndo: boolean;
  /** When « Lancer la partie » was pressed: the game's length, for the environment's panel. */
  startedAt: number | null;
  projection: { connected: boolean; mediaReady: number; mediaTotal: number; mic: boolean };
  suggested: "village" | "meute" | null;
  clues: { at: string; text: string }[];
  recap: ReturnType<typeof recap>;
  /** Where « Revenir à » can go: each arrival, nightfall and dawn, with its journal position. */
  marks: { seq: number; label: string }[];
  cohosts: { memberId: string; name: string }[];
  /** Server time, for the scenario's loading bar. */
  now: number;
}

export async function getConsoleView(g: ScenarioGame, def: ScenarioDef, role: "host" | "cohost", memberId: string): Promise<ConsoleView> {
  const setup = setupOf(g, def);
  const rows = await journal(g);
  let state = initialState(def, setup);
  const marks: ConsoleView["marks"] = [];
  for (const r of rows) {
      const action = r.action as unknown as Action;
      state = apply(def, setup, state, action, r.createdAt.getTime());
    if (["arrive", "night", "dawn", "reboot"].includes(action.t)) marks.push({ seq: r.seq, label: momentOf(state) });
  }
  return {
    code: g.code,
    link: projectionLink(g.token),
    status: g.status as ConsoleView["status"],
    simulated: g.simulated,
    role,
    setup,
    state,
    canUndo: g.status !== "done" && rows.some((r) => ((r.action as { by?: string }).by ?? (role === "host" ? memberId : null)) === memberId),
    startedAt: g.startedAt?.getTime() ?? null,
    projection: {
      connected: !!g.projectionSeenAt && Date.now() - g.projectionSeenAt.getTime() < PROJECTION_TIMEOUT_MS,
      mediaReady: g.mediaReady,
      mediaTotal: g.mediaTotal,
      mic: g.micReady,
    },
    suggested: suggestedWinner(state),
    clues: missedClues(def, setup, state),
    recap: recap(state),
    marks,
    cohosts: await cohostsOf(g),
    now: Date.now(),
  };
}

/** What the room may see: no camp, no night secret. The faults read a little more, on purpose. */
export interface ProjectionView {
  version: number;
  status: "setup" | "live" | "done";
  scenarioId: string;
  simulated: boolean;
  players: { id: string; name: string; room: number; status: "alive" | "dead" | "exiled"; diedAt: string | null }[];
  /** Never a side, never a secret item (nor that it was found), never the chief's resistance. */
  state: PublicState;
  /** The last actions, for effects played once (a glitch, a sound, a refused door…). */
  recent: { seq: number; at: number; action: Action }[];
  clues: { at: string; text: string }[];
  /** The day events and the organizer's own faults, to show them. */
  events: Setup["events"];
  extraFaults: Setup["extraFaults"];
  files: NonNullable<Setup["files"]>;
  dates: NonNullable<Setup["dates"]>;
  /** Server time, to time the gauge. */
  now: number;
}

export async function getProjectionView(g: ScenarioGame, def: ScenarioDef): Promise<ProjectionView> {
  const setup = setupOf(g, def);
  const rows = await journal(g);
  const full = stateOf(def, setup, rows);
  return {
    version: g.version,
    status: g.status as ProjectionView["status"],
    scenarioId: def.id,
    simulated: g.simulated,
    players: full.players.map((p) => ({ id: p.id, name: p.name, room: p.room, status: p.status, diedAt: p.diedAt })),
    state: publicState(def, setup, full),
    // The night's secrets never reach the room's screen, not even in the data.
    recent: publicRecent(rows.map((r) => ({ seq: r.seq, at: r.createdAt.getTime(), action: r.action as unknown as Action }))),
    clues: full.phase === "bad" ? missedClues(def, setup, full) : [],
    events: setup.events,
    extraFaults: setup.extraFaults,
    files: setup.files ?? {},
    dates: setup.dates ?? {},
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

// ───────── Simulations ─────────

/** A real evening of this member's that's being played: « Simuler » waits until it's over. */
export async function liveRealEvening(memberId: string): Promise<boolean> {
  const cohosted = db.select({ id: scenarioCohost.gameId }).from(scenarioCohost).where(eq(scenarioCohost.memberId, memberId));
  const [row] = await db
    .select({ id: scenarioGame.id })
    .from(scenarioGame)
    .where(and(eq(scenarioGame.status, "live"), eq(scenarioGame.simulated, false), or(eq(scenarioGame.hostMemberId, memberId), inArray(scenarioGame.id, cohosted))))
    .limit(1);
  return !!row;
}

/** « Simuler une partie »: 20 fictive players, launched, the journal written up to `start`. */
export async function simulateEvening(hostId: string, def: ScenarioDef, start: StartPoint): Promise<{ ok: true; game: ScenarioGame } | { ok: false; error: string }> {
  if (await liveRealEvening(hostId)) return fail("Une vraie soirée est en cours : la simulation attendra qu'elle soit terminée.");
  const random = () => randomInt(1_000_000) / 1_000_000;
  // No first name of a real evening, so a rehearsal can't be mistaken for one.
  const real = await db.select({ setup: scenarioGame.setup }).from(scenarioGame).where(eq(scenarioGame.simulated, false));
  const taken = real.flatMap((r) => ((r.setup as Partial<Setup>).players ?? []).map((p) => p.name));
  const setup: Setup = { players: simulatedPlayers(random, taken), params: def.defaults, events: def.events, extraFaults: [], files: {}, dates: {} };
  const [game] = await db
    .insert(scenarioGame)
    .values({ code: await newCode(), token: randomBytes(24).toString("base64url"), scenarioId: def.id, hostMemberId: hostId, simulated: true, status: "live", startedAt: new Date(), setup: setup as unknown as Record<string, unknown> })
    .returning();
  if (!game) return fail("La simulation n'a pas pu être créée.");
  const journal = simulatedJournal(def, setup, start, random);
  if (journal.length) await db.insert(scenarioAction).values(journal.map((action) => ({ gameId: game.id, action: action as unknown as Record<string, unknown> })));
  return { ok: true, game };
}

export async function deleteSimulations(memberId: string): Promise<number> {
  const gone = await db
    .delete(scenarioGame)
    .where(and(eq(scenarioGame.hostMemberId, memberId), eq(scenarioGame.simulated, true)))
    .returning({ id: scenarioGame.id });
  return gone.length;
}

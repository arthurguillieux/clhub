import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { alive, apply, doorProposals, initialState, nightSteps, proposals, registry, replay, suggestedWinner, timeLeft, type Action, type Phase, type Setup, type State } from "./engine";
import { NIGHT_SECRETS, publicRecent, publicState } from "./public";
import { DEFAULT_TEXTS, suggestTexts, textVars } from "./texts";

/**
 * Hundreds of evenings played at random, every gesture of the console in any order (as a tired meneur
 * might), checked after each action: nothing breaks, the base stays coherent, the projection never
 * learns a secret, the texts always open something that exists.
 */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const PLAYERS = Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, name: `Joueur${i + 1}` }));
const setup: Setup = { players: PLAYERS, params: ANTARCTICA.defaults, events: ANTARCTICA.events, extraFaults: [] };
const IDS = new Set(DEFAULT_TEXTS.textes.map((t) => t.id));
const ACTIONS = new Set([...ANTARCTICA.dayActions.map((a) => a.id), "fouiller"]);
const SECRET_ITEMS = ["bandes", "vie", "mort", "seringues"];

function randomAction(s: State, r: () => number): Action {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const player = () => pick(PLAYERS).id;
  const maybe = () => (r() < 0.15 ? null : player());
  // The course of the evening comes often, so that every phase is reached.
  const course: Action[] = [{ t: "start" }, { t: "arrive" }, { t: "patientZero", player: player() }, { t: "night" }, { t: "dawn" }, { t: "endLoop", winner: pick(["village", "meute"] as const) }, { t: "reboot" }];
  if (r() < 0.25) return pick(course);
  const doors = doorProposals(ANTARCTICA, s);
  const all: Action[] = [
    { t: "light", on: r() < 0.7 },
    { t: "cut" },
    { t: "door", door: pick(ANTARCTICA.doors).id, open: r() < 0.7, force: r() < 0.2 },
    { t: "terminal", id: r() < 0.2 ? null : pick(ANTARCTICA.terminals).id },
    { t: "play", file: pick(ANTARCTICA.terminals.flatMap((t) => t.files)).id },
    { t: "circuit", show: r() < 0.5 },
    { t: "switch", index: Math.floor(r() * 4), up: r() < 0.5 },
    { t: "power" },
    { t: "glitch" },
    { t: "blizzard", on: r() < 0.5 },
    { t: "dark", on: r() < 0.5 },
    { t: "gauge", seconds: r() < 0.3 ? null : 120 },
    { t: "timer", which: pick(["gauge", "main"] as const), cmd: pick(["start", "pause", "resume", "plus", "minus", "stop"] as const), seconds: pick([30, 60, 300]) },
    { t: "faultToggle", id: r() < 0.3 ? null : pick(ANTARCTICA.faults).id, on: r() < 0.6 },
    { t: "fault", id: pick(ANTARCTICA.faults).id },
    { t: "stop" },
    { t: "neutral", mode: pick(["plan", "black", null] as const) },
    { t: "media", cmd: pick(["play", "pause", "restart", "back", "forward"] as const) },
    { t: "jump", phase: pick(["bus", "arrival", "night", "day", "loopEnd"] as Phase[]) },
    { t: "room", player: player(), room: 1 + Math.floor(r() * PLAYERS.length) },
    { t: "intrusion", text: r() < 0.5 ? "Bonsoir." : null },
    { t: "sound", slot: pick(ANTARCTICA.media).id },
    { t: "stopSound", slot: r() < 0.5 ? null : pick(ANTARCTICA.media).id },
    { t: "panic", player: maybe() },
    { t: "tapes", target: maybe() },
    { t: "infect", player: maybe() },
    { t: "victim", player: maybe() },
    { t: "useItem", item: pick(ANTARCTICA.items).id, target: maybe() },
    { t: "giveItem", item: pick([...ANTARCTICA.items.map((i) => i.id), "seringues"]), player: maybe() },
    { t: "skip", step: pick(nightSteps(s, setup.params, ANTARCTICA).concat("dead")) },
    { t: "exile", player: maybe() },
    { t: "kill", player: player() },
    { t: "revive", player: player() },
    { t: "setInfected", player: player(), infected: r() < 0.5 },
    { t: "goodEnd" },
    { t: "badEnd" },
    { t: "vote", kind: "door", options: doors.length ? doors : ["fouiller"] },
    { t: "vote", kind: "dead", options: proposals(s, setup).length ? proposals(s, setup) : ["blizzard"] },
    { t: "vote", kind: "chief", options: [player(), player()] },
    { t: "voteResult", choice: s.vote ? pick(s.vote.options) : r() < 0.5 ? null : pick([...ACTIONS]) },
    { t: "dayAction", id: pick([...ACTIONS]) },
    { t: "labForce" },
    { t: "chief", player: maybe() },
    { t: "chiefConfirm" },
    { t: "shoot", target: player() },
    { t: "bloodTest", target: player() },
    { t: "radio" },
    { t: "quarantine", players: [player(), player()] },
    { t: "confinement", on: r() < 0.5 },
    { t: "flag", flag: pick(["key", "badge2", "badge3", "code", "power"] as const), on: r() < 0.7 },
  ];
  return pick(all);
}

function check(s: State, journal: Action[]) {
  // The base stays coherent.
  expect([...s.players.map((p) => p.room)].sort((a, b) => a - b)).toEqual(PLAYERS.map((_, i) => i + 1));
  for (const held of Object.values(s.items)) if (held.holder) expect(PLAYERS.some((p) => p.id === held.holder)).toBe(true);
  for (const id of s.quarantine) expect(PLAYERS.some((p) => p.id === id)).toBe(true);
  if (s.gauge) expect(timeLeft(s.gauge, 1e12)).toBeGreaterThanOrEqual(0);
  if (s.timer) expect(timeLeft(s.timer, 0)).toBeGreaterThanOrEqual(0);
  expect(s.log.every((l) => l.text.length > 0 && !l.text.includes("undefined"))).toBe(true);
  for (const id of doorProposals(ANTARCTICA, s)) expect(ACTIONS.has(id)).toBe(true);
  expect(new Set(s.eventsPlayed).size).toBe(s.eventsPlayed.length);
  for (const e of proposals(s, setup)) expect(s.eventsPlayed).not.toContain(e);
  suggestedWinner(s);
  // The projection never learns a side, a night secret, a secret item or the chief's resistance.
  const pub = publicState(ANTARCTICA, setup, s);
  // A shot's outcome is public by the rules (the room sees whether the shooter falls too): only that.
  const json = JSON.stringify({ ...pub, lastShot: pub.lastShot ? { ...pub.lastShot, infected: undefined } : null });
  for (const key of ["tonight", "infected", "patientZero", "chiefResisted", "trusted", "items", "lastExile"]) expect(json).not.toContain(`"${key}"`);
  for (const id of SECRET_ITEMS) {
    expect(pub.found).not.toContain(id);
    expect(pub.foundToday).not.toContain(id);
  }
  expect(registry(s).join("\n")).not.toMatch(/CONTAMIN|SAIN\b/);
  const recent = publicRecent(journal.map((action, seq) => ({ seq, action })));
  expect(recent.some((r) => NIGHT_SECRETS.has(r.action.t))).toBe(false);
  // The texts always open something that exists, and never break on a variable.
  const { ids, at } = suggestTexts(ANTARCTICA, setup, s);
  for (const id of ids) expect(IDS.has(id)).toBe(true);
  expect(at).toBeGreaterThanOrEqual(0);
  if (ids.length) expect(at).toBeLessThan(ids.length);
  for (const id of ids) textVars(s, id);
}

describe("Antarctica, played at random", () => {
  // 60 evenings in the CI; FUZZ_RUNS=600 FUZZ_SEED=1000 for a long hunt.
  const runs = Number(process.env.FUZZ_RUNS ?? 60);
  const seed = Number(process.env.FUZZ_SEED ?? 1);
  it(`survives ${runs} random evenings of 160 gestures each, and replays exactly from its journal`, () => {
    let phases = new Set<Phase>();
    let loops = 0;
    for (let run = 0; run < runs; run++) {
      const r = seeded(run + seed);
      const journal: Action[] = [];
      let s = initialState(ANTARCTICA, setup);
      for (let i = 0; i < 160; i++) {
        const a = randomAction(s, r);
        journal.push(a);
        s = apply(ANTARCTICA, setup, s, a, i * 1000);
        check(s, journal);
        phases = phases.add(s.phase);
        loops = Math.max(loops, s.loop);
      }
      // Undo is replaying the journal: the same gestures give the same evening.
      expect(replay(ANTARCTICA, setup, journal.map((action, i) => ({ action, at: i * 1000 })))).toEqual(s);
      expect(alive(s).length).toBeLessThanOrEqual(PLAYERS.length);
    }
    // The random walk really went everywhere.
    expect([...phases].sort()).toEqual(["arrival", "bad", "bus", "day", "good", "loopEnd", "night", "welcome"]);
    expect(loops).toBeGreaterThanOrEqual(2);
  }, 600_000);
});

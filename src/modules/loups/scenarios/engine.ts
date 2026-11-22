/**
 * A scenario evening, played from its journal: every gesture of the console is an action, and the
 * state is rebuilt from the list. « Annuler » removes the last action; nothing else can go stale.
 * Pure functions on plain values: the console proposes, the meneur confirms (and can force anything).
 */
import type { DayEvent, Fault, Flag, ScenarioDef, ScenarioParams } from "./types";

export interface Setup {
  players: { id: string; name: string }[];
  params: ScenarioParams;
  events: DayEvent[];
  extraFaults: Fault[];
  /** Per terminal file: the name and date shown, a text file's words, subtitles (« 0:03 Réplique » per line). */
  files?: Record<string, { name?: string; date?: string; text?: string; subs?: string }>;
  /** The HUD's in-world date and the real one a fault shows. */
  dates?: { world?: string; real?: string };
  /** « Textes à lire »: an imported file, and the hand edits on top. */
  texts?: { imported?: { textes: { id: string; partie: string; titre: string; quand: string; texte: string }[]; version?: string }; edited?: Record<string, string> };
}

export type Phase = "welcome" | "bus" | "arrival" | "night" | "day" | "loopEnd" | "good" | "bad";
export type NightStepId = "pz" | "handover" | "panic" | "tapes" | "infect" | "victim" | "items" | "dead";
export type VoteKind = "door" | "dead" | "chief";

export type Action =
  | { t: "start" }
  | { t: "arrive" }
  | { t: "patientZero"; player: string }
  | { t: "light"; on: boolean }
  | { t: "cut" }
  | { t: "door"; door: string; open: boolean; force?: boolean }
  | { t: "terminal"; id: string | null }
  | { t: "play"; file: string }
  | { t: "circuit"; show: boolean }
  | { t: "switch"; index: number; up: boolean }
  | { t: "power" }
  | { t: "glitch" }
  | { t: "blizzard"; on: boolean }
  | { t: "dark"; on: boolean }
  | { t: "aurora"; on: boolean }
  | { t: "gauge"; seconds: number | null }
  | { t: "timer"; which: "gauge" | "main"; cmd: "start" | "pause" | "resume" | "plus" | "minus" | "stop"; seconds?: number; label?: string }
  | { t: "faultToggle"; id: string | null; on: boolean }
  | { t: "stop" }
  | { t: "neutral"; mode: "plan" | "black" | null }
  | { t: "media"; cmd: "play" | "pause" | "restart" | "back" | "forward" }
  | { t: "jump"; phase: Phase }
  | { t: "room"; player: string; room: number }
  | { t: "intrusion"; text: string | null }
  | { t: "sound"; slot: string }
  | { t: "stopSound"; slot: string | null }
  | { t: "record" }
  | { t: "fault"; id: string }
  | { t: "night" }
  | { t: "panic"; player: string | null }
  | { t: "tapes"; target: string | null }
  | { t: "infect"; player: string | null }
  | { t: "victim"; player: string | null }
  | { t: "useItem"; item: string; target: string | null }
  | { t: "giveItem"; item: string; player: string | null }
  | { t: "propose"; events: string[] }
  | { t: "deadChoose"; event: string | null }
  | { t: "skip"; step: NightStepId }
  | { t: "dawn" }
  | { t: "exile"; player: string | null }
  | { t: "kill"; player: string }
  | { t: "revive"; player: string }
  | { t: "setInfected"; player: string; infected: boolean }
  | { t: "endLoop"; winner: "village" | "meute" }
  | { t: "reboot" }
  | { t: "goodEnd" }
  | { t: "badEnd" }
  // V1.2
  | { t: "vote"; kind: VoteKind; options: string[] }
  | { t: "voteResult"; choice: string | null }
  | { t: "dayAction"; id: string }
  | { t: "labForce" }
  | { t: "chief"; player: string | null }
  | { t: "chiefConfirm" }
  | { t: "shoot"; target: string }
  | { t: "bloodTest"; target: string }
  | { t: "radio" }
  | { t: "quarantine"; players: string[] }
  | { t: "confinement"; on: boolean }
  | { t: "flag"; flag: Flag; on: boolean };

/** A countdown: running until `endsAt` (ms), or paused with `remaining` seconds left. */
export interface Timer {
  label: string;
  total: number;
  endsAt: number | null;
  remaining: number | null;
}

/** Seconds left on a timer at `now` (ms). */
export function timeLeft(t: Timer, now: number): number {
  return Math.max(0, t.endsAt !== null ? (t.endsAt - now) / 1000 : (t.remaining ?? 0));
}

function runTimer(t: Timer | null, cmd: "start" | "pause" | "resume" | "plus" | "minus" | "stop", when: number, seconds?: number, label?: string): Timer | null {
  if (cmd === "stop") return null;
  if (cmd === "start") {
    const total = Math.max(1, seconds ?? t?.total ?? 60);
    return { label: label ?? t?.label ?? "", total, endsAt: when + total * 1000, remaining: null };
  }
  if (!t) return null;
  const left = timeLeft(t, when);
  if (cmd === "pause") return t.endsAt === null ? t : { ...t, endsAt: null, remaining: left };
  if (cmd === "resume") return t.endsAt !== null ? t : { ...t, endsAt: when + left * 1000, remaining: null };
  const step = seconds ?? 60;
  const next = Math.max(0, left + (cmd === "plus" ? step : -step));
  return t.endsAt !== null ? { ...t, endsAt: when + next * 1000, total: Math.max(t.total, next) } : { ...t, remaining: next, total: Math.max(t.total, next) };
}

export interface PlayerState {
  id: string;
  name: string;
  room: number;
  status: "alive" | "dead" | "exiled";
  infected: boolean;
  /** « Boucle 1 · Nuit 2 », or « patient zéro ». */
  infectedAt: string | null;
  /** The pack that night, by name. */
  infectedBy: string | null;
  /** When they died or were exiled in this loop: « Boucle 1 · Nuit 2 ». */
  diedAt: string | null;
}

export interface State {
  phase: Phase;
  loop: number;
  /** Nights (and days) of this loop: night n is followed by day n. */
  round: number;
  players: PlayerState[];
  patientZero: string | null;
  light: boolean;
  doors: Record<string, boolean>;
  /** Rooms sealed by the base's memory: room number → the name of who died there in an earlier loop. */
  sealed: Record<number, string>;
  terminal: string | null;
  playing: string | null;
  circuitShown: boolean;
  switches: [boolean, boolean, boolean, boolean];
  panicReady: boolean;
  /** The last « Mettre sous tension »: whether the combination was right. */
  lastPower: boolean | null;
  blizzard: boolean;
  aurora: boolean;
  /** Délestage: the base nearly black, a lamp's beam only. */
  dark: boolean;
  /** Tour de garde: the even rooms lit. */
  parity: boolean;
  /** The base cut in two (odd / even rooms). */
  confinement: boolean;
  /** The generators' gauge, and the evening's main timer (votes, debate…). */
  gauge: Timer | null;
  timer: Timer | null;
  /** Faults switched off: they can't be triggered, even by mistake. */
  faultsOff: string[];
  /** « Écran neutre »: the plan alone, or black, whatever was going on. */
  neutral: "plan" | "black" | null;
  intrusion: string | null;
  /** Looping sounds playing on the projection. */
  ambiances: string[];
  items: Record<string, { holder: string | null; used: boolean }>;
  /** Items found (they stay found from one loop to the next), and those found today (to hand over tonight). */
  found: string[];
  foundToday: string[];
  /** What the village holds: the key, the badges, the code, the power. */
  flags: Record<Flag, boolean>;
  /** Day actions done, for the whole evening (« une action déjà faite n'est plus proposée »). */
  actionsDone: string[];
  /** Today's door, once chosen. */
  lastAction: string | null;
  /** A vote by moving on the projection: a door, the dead's event, the chief. */
  vote: { kind: VoteKind; options: string[] } | null;
  chief: string | null;
  /** The chief who just died or was exiled: the texts still name them while the successor is chosen. */
  formerChief: string | null;
  /** Loop 1's chief, to confirm at the start of loop 2. */
  chiefB1: string | null;
  chiefToConfirm: boolean;
  /** The chief already resisted the pack's first attack this loop. */
  chiefResisted: boolean;
  /** A healthy chief was exiled: every power of the village is locked until the end of the loop. */
  locked: boolean;
  /** Shooters who hit a contaminated target: « de confiance ». */
  trusted: string[];
  lastShot: { shooter: string; target: string; infected: boolean } | null;
  lastTest: { target: string; positive: boolean } | null;
  lastRadio: number | null;
  /** Room powers, once per loop. */
  roomUsed: { test: boolean; radio: boolean };
  /** Quarantine: protected from the pack the next night. */
  quarantine: string[];
  /** The village's choice for tonight's panic room. */
  panicNext: string | null;
  tonight: {
    panic: string | null;
    infect: string | null;
    victim: string | null;
    life: string | null;
    death: string | null;
    /** The surveillance tapes: who was watched, and their side at the start of the night. */
    tapes: { target: string; infected: boolean } | null;
    proposed: string[];
    chosen: string | null;
    done: NightStepId[];
  };
  /** Today's event, chosen by the dead last night. */
  event: string | null;
  /** Events already played this evening: each one is played once at most. */
  eventsPlayed: string[];
  /** Deaths announced this morning, for the projection. */
  announced: string[];
  lastExile: { player: string; chief: boolean; healthy: boolean } | null;
  faults: { id: string; at: string }[];
  /** The loops gone by: who died or was exiled, and when (for SUJETS.DAT). */
  past: { loop: number; players: { id: string; status: PlayerState["status"]; at: string | null }[] }[];
  winner: "village" | "meute" | null;
  log: { at: string; text: string }[];
}

const emptyNight = (): State["tonight"] => ({ panic: null, infect: null, victim: null, life: null, death: null, tapes: null, proposed: [], chosen: null, done: [] });
const noFlags = (): Record<Flag, boolean> => ({ key: false, badge2: false, badge3: false, code: false, power: false });

export function initialState(def: ScenarioDef, setup: Setup): State {
  return {
    phase: "welcome",
    loop: 1,
    round: 0,
    players: setup.players.map((p, i) => ({ id: p.id, name: p.name, room: i + 1, status: "alive", infected: false, infectedAt: null, infectedBy: null, diedAt: null })),
    patientZero: null,
    light: false,
    doors: Object.fromEntries(def.doors.map((d) => [d.id, false])),
    sealed: {},
    terminal: null,
    playing: null,
    circuitShown: false,
    switches: [false, false, false, false],
    panicReady: false,
    lastPower: null,
    blizzard: false,
    aurora: false,
    dark: false,
    parity: false,
    confinement: false,
    gauge: null,
    timer: null,
    faultsOff: [],
    neutral: null,
    intrusion: null,
    ambiances: [],
    items: Object.fromEntries(def.items.map((i) => [i.id, { holder: null, used: false }])),
    found: [],
    foundToday: [],
    flags: noFlags(),
    actionsDone: [],
    lastAction: null,
    vote: null,
    chief: null,
    formerChief: null,
    chiefB1: null,
    chiefToConfirm: false,
    chiefResisted: false,
    locked: false,
    trusted: [],
    lastShot: null,
    lastTest: null,
    lastRadio: null,
    roomUsed: { test: false, radio: false },
    quarantine: [],
    panicNext: null,
    tonight: emptyNight(),
    event: null,
    eventsPlayed: [],
    announced: [],
    lastExile: null,
    faults: [],
    past: [],
    winner: null,
    log: [],
  };
}

/** « Boucle 1 · Nuit 2 », « Boucle 2 · Jour 1 ». */
export function momentOf(s: Pick<State, "phase" | "loop" | "round">): string {
  const loop = `Boucle ${s.loop}`;
  if (s.phase === "night") return `${loop} · Nuit ${s.round}`;
  if (s.phase === "day") return `${loop} · Jour ${s.round}`;
  if (s.phase === "arrival") return `${loop} · Arrivée`;
  if (s.phase === "bus") return s.loop === 1 ? "Prologue du bus" : `${loop} · Le bus`;
  if (s.phase === "loopEnd") return `${loop} · Fin de boucle`;
  if (s.phase === "good") return "Bonne fin";
  if (s.phase === "bad") return "Mauvaise fin";
  return "Accueil";
}

export const alive = (s: State) => s.players.filter((p) => p.status === "alive");
export const pack = (s: State) => alive(s).filter((p) => p.infected);

/** Whether the pack still contaminates tonight: the first N nights only, and under the pack's ceiling. */
export function contagionActive(s: State, params: ScenarioParams): boolean {
  return s.round <= params.contagionNights && pack(s).length < params.packMax;
}

const holderAlive = (s: State, id: string) => {
  const held = s.items[id];
  return !!held && !held.used && !!held.holder && s.players.find((p) => p.id === held.holder)?.status === "alive";
};

/** Secret items found today: the meneur hands them over tonight (a touch on the shoulder). */
export const secretFoundToday = (def: Pick<ScenarioDef, "items">, s: State) =>
  s.foundToday.flatMap((id) => (id === "seringues" ? ["vie"] : [id])).filter((id) => def.items.find((i) => i.id === id)?.family === "secret");

/** The steps of tonight's wizard, in order (V1.2: night 1 is shorter). */
export function nightSteps(s: State, params: ScenarioParams, def?: Pick<ScenarioDef, "items">): NightStepId[] {
  const steps: NightStepId[] = [];
  if (s.round === 1) {
    steps.push("pz");
    if (contagionActive(s, params)) steps.push("infect");
    steps.push("victim");
    if (!s.locked && (holderAlive(s, "vie") || holderAlive(s, "mort"))) steps.push("items");
    return steps;
  }
  if (def && secretFoundToday(def, s).length) steps.push("handover");
  if (s.panicReady && s.tonight.panic && !s.locked) steps.push("panic");
  if (!s.locked && holderAlive(s, "bandes")) steps.push("tapes");
  if (contagionActive(s, params)) steps.push("infect");
  steps.push("victim");
  if (!s.locked && (holderAlive(s, "vie") || holderAlive(s, "mort"))) steps.push("items");
  // The dead's moment: only when someone is already dead (tonight's victim doesn't vote).
  if (s.players.some((p) => p.status !== "alive")) steps.push("dead");
  return steps;
}

/** Whether the pack's attack on this player fails tonight: panic room, quarantine, the chief's first resistance. */
function shielded(s: State, id: string | null, resisted: boolean): "panic" | "quarantine" | "chief" | null {
  if (!id) return null;
  if (s.tonight.panic === id && s.panicReady && !s.locked) return "panic";
  if (s.quarantine.includes(id)) return "quarantine";
  if (s.chief === id && !resisted) return "chief";
  return null;
}

/** Who dies at dawn: the victim (unless protected or saved), the death syringe's target. */
export function dawnDeaths(s: State): string[] {
  const n = s.tonight;
  const out: string[] = [];
  // Two attacks on the chief the same night count as one: the resistance holds against both (V1.3).
  if (n.victim && !shielded(s, n.victim, s.chiefResisted) && n.victim !== n.life) out.push(n.victim);
  if (n.death && !out.includes(n.death)) out.push(n.death);
  return out.filter((id) => s.players.find((p) => p.id === id)?.status === "alive");
}

/** The side the console suggests has won; the meneur confirms. */
export function suggestedWinner(s: State): "village" | "meute" | null {
  if (s.phase !== "day" && s.phase !== "night") return null;
  const a = alive(s);
  const p = a.filter((x) => x.infected).length;
  if (!s.patientZero) return null;
  if (p === 0) return "village";
  if (p >= a.length - p) return "meute";
  return null;
}

/** The events to propose to the dead: two not played yet, turning with the nights. */
export function proposals(s: State, setup: Setup): string[] {
  const n = Math.max(1, Math.min(setup.events.length, setup.params.eventsProposed));
  const pool = setup.events.filter((e) => !s.eventsPlayed.includes(e.id));
  if (pool.length === 0) return [];
  const start = (s.round - 1 + (s.loop - 1) * 3) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, n).map((e) => e.id);
}

/** Whether a day action can be done now: not done yet, and its access found. */
export function actionAvailable(def: Pick<ScenarioDef, "dayActions">, s: State, id: string): boolean {
  const a = def.dayActions.find((x) => x.id === id);
  if (!a || s.actionsDone.includes(id)) return false;
  if (a.zone === "hall" && !s.light) return false;
  return !a.requires || s.flags[a.requires];
}

/**
 * Today's two doors. The plan suggests them (Arthur's route), the rest follows; a door is only offered
 * if its access is found. With a single one, the other is « Fouiller ce qu'on connaît déjà ». Loop 2,
 * day 3: the laboratory, imposed. Loop 2, day 4: no door, the vote against the meneur.
 */
export function doorProposals(def: Pick<ScenarioDef, "dayActions" | "dayPlan">, s: State): string[] {
  if (s.loop >= 2 && s.round === 3) return ["labo"];
  if (s.loop >= 2 && s.round >= 4) return [];
  const plan = def.dayPlan[`${s.loop}-${s.round}`] ?? [];
  const order = [...new Set([...plan, ...def.dayActions.map((a) => a.id)])].filter((id) => id !== "labo" || plan.includes("labo"));
  const open = order.filter((id) => actionAvailable(def, s, id)).slice(0, 2);
  return open.length === 2 ? open : [...open, "fouiller"];
}

const nameOf = (s: State, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "personne";

export const flagName = (f: Flag) => ({ key: "la clé de Bêta", badge2: "le badge de niveau 2", badge3: "le badge de niveau 3", code: "le code des générateurs", power: "le courant" })[f];

/** The meneur's choice of a day action, its effects on the base: doors, flags, items found. */
function doDayAction(def: ScenarioDef, s: State, id: string, at: string): State {
  const log = (text: string): State["log"] => [...s.log, { at, text }];
  if (id === "fouiller") return { ...s, lastAction: "fouiller", log: log("Le village fouille ce qu'il connaît déjà.") };
  const a = def.dayActions.find((x) => x.id === id);
  if (!a) return s;
  const firstArchives = a.zone === "beta" && !s.actionsDone.some((x) => def.dayActions.find((y) => y.id === x)?.zone === "beta");
  const flags = { ...s.flags };
  for (const f of a.gives ?? []) flags[f] = true;
  const itemName = (f: string) => (f === "seringues" ? "les seringues" : (def.items.find((i) => i.id === f)?.name ?? f));
  return {
    ...s,
    flags,
    found: [...new Set([...s.found, ...(a.finds ?? [])])],
    foundToday: [...new Set([...s.foundToday, ...(a.finds ?? [])])],
    doors: a.zone === "hall" || !(a.zone in s.doors) ? s.doors : { ...s.doors, [a.zone]: true },
    actionsDone: [...new Set([...s.actionsDone, id])],
    lastAction: id,
    // The first entry into the archives wakes their terminal (log 2).
    terminal: firstArchives ? "beta" : s.terminal,
    playing: firstArchives ? "log2" : s.playing,
    circuitShown: id === "archives-panic" && !firstArchives ? true : s.circuitShown,
    log: log(`Le village choisit : ${a.label}.${a.finds?.length ? ` Trouvé : ${a.finds.map(itemName).join(", ")}.` : ""}${a.gives?.length ? ` Acquis : ${a.gives.map(flagName).join(", ")}.` : ""}`),
  };
}

/** One action applied. Unknown or impossible actions leave the state as it was. */
export function apply(def: ScenarioDef, setup: Setup, s: State, a: Action, when = 0): State {
  const next = applyAction(def, setup, s, a, when);
  return s.chief && !next.chief && next !== s ? { ...next, formerChief: s.chief } : next;
}

function applyAction(def: ScenarioDef, setup: Setup, s: State, a: Action, when: number): State {
  const at = momentOf(s);
  const log = (text: string): State["log"] => [...s.log, { at, text }];
  const setPlayer = (id: string, change: Partial<PlayerState>) => s.players.map((p) => (p.id === id ? { ...p, ...change } : p));
  const dropChief = (id: string) => (s.chief === id ? null : s.chief);
  const params = setup.params;
  switch (a.t) {
    case "start":
      return s.phase === "welcome" ? { ...s, phase: "bus", log: log("Prologue du bus.") } : s;
    case "arrive":
      if (s.phase !== "bus") return s;
      return { ...s, phase: "arrival", round: 0, log: log("Arrivée à la base.") };
    case "patientZero":
      if (!s.players.some((p) => p.id === a.player)) return s;
      return {
        ...s,
        patientZero: a.player,
        players: s.players.map((p) => (p.id === a.player ? { ...p, infected: true, infectedAt: "patient zéro", infectedBy: null } : p.infectedAt === "patient zéro" ? { ...p, infected: false, infectedAt: null } : p)),
        log: log(`Patient zéro : ${nameOf(s, a.player)}.`),
      };
    case "light":
      return { ...s, light: a.on, log: log(a.on ? "Lumière : hall allumé." : "Lumière : hall éteint.") };
    case "cut":
      return { ...s, log: log("Coupure du générateur.") };
    case "door": {
      const door = def.doors.find((d) => d.id === a.door);
      if (!door) return s;
      if (door.locked && !a.force) return { ...s, log: log(`Porte ${door.letter} ${door.label} : accès refusé.`) };
      return { ...s, doors: { ...s.doors, [a.door]: a.open }, log: log(`Porte ${a.open ? "ouverte" : "fermée"} : ${door.letter} ${door.label}.`) };
    }
    case "terminal": {
      const term = def.terminals.find((x) => x.id === a.id);
      return { ...s, terminal: term ? term.id : null, playing: null, circuitShown: false, neutral: null, log: term ? log(`Terminal ouvert : ${term.label}.`) : s.log };
    }
    case "play": {
      const term = def.terminals.find((x) => x.id === s.terminal);
      const file = term?.files.find((f) => f.id === a.file);
      if (!file) return s;
      return { ...s, playing: file.id, log: log(`Fichier lancé : ${setup.files?.[file.id]?.name || file.name}.`) };
    }
    case "circuit":
      return { ...s, circuitShown: a.show, terminal: a.show ? null : s.terminal, playing: null, neutral: a.show ? null : s.neutral };
    case "switch": {
      if (a.index < 0 || a.index > 3) return s;
      const switches = [...s.switches] as State["switches"];
      switches[a.index] = a.up;
      return { ...s, switches };
    }
    case "power": {
      const ok = s.switches.every((v, i) => v === params.circuit[i]);
      return { ...s, circuitShown: true, panicReady: s.panicReady || ok, lastPower: ok, log: log(ok ? "Circuit : panic room opérationnelle." : "Circuit : court-circuit.") };
    }
    case "glitch":
      return { ...s, log: log("Effet : faille.") };
    case "blizzard":
      return { ...s, blizzard: a.on };
    case "dark":
      return { ...s, dark: a.on, log: log(a.on ? "Délestage : la base tombe dans le noir." : "Délestage levé : l'éclairage revient.") };
    case "aurora":
      return { ...s, aurora: a.on };
    case "gauge":
      return { ...s, gauge: a.seconds ? runTimer(null, "start", when, a.seconds, "Carburant") : null };
    case "timer": {
      const next = runTimer(a.which === "gauge" ? s.gauge : s.timer, a.cmd, when, a.seconds, a.label);
      return a.which === "gauge" ? { ...s, gauge: next } : { ...s, timer: next };
    }
    case "faultToggle": {
      const all = [...def.faults, ...setup.extraFaults];
      const ids = a.id ? [a.id] : all.map((f) => f.id);
      const faultsOff = a.on ? s.faultsOff.filter((x) => !ids.includes(x)) : [...new Set([...s.faultsOff, ...ids])];
      return { ...s, faultsOff, log: log(a.id ? `Faille ${a.on ? "activée" : "désactivée"} : ${all.find((f) => f.id === a.id)?.title ?? a.id}.` : `Toutes les failles ${a.on ? "activées" : "désactivées"}.`) };
    }
    case "stop":
      // Everything that plays on the projection stops; the base itself stays as it is.
      return { ...s, playing: null, ambiances: [], gauge: null, timer: null, intrusion: null, blizzard: false, aurora: false, vote: null, log: log("Stop : tout s'arrête sur la projection.") };
    case "neutral":
      return { ...s, neutral: a.mode, ...(a.mode ? { terminal: null, playing: null, circuitShown: false, intrusion: null } : {}) };
    case "media":
      // Play, pause, rewind… happen on the projection only: the evening's state doesn't change.
      return s;
    case "jump": {
      // The meneur's « Sauter à »: no rule checked, the phase is simply set.
      const round = a.phase === "night" ? s.round + 1 : a.phase === "bus" || a.phase === "arrival" ? 0 : Math.max(1, s.round);
      const newDay = a.phase !== s.phase || round !== s.round;
      return {
        ...s,
        phase: a.phase,
        round,
        vote: null,
        lastAction: newDay ? null : s.lastAction,
        foundToday: newDay && a.phase !== "night" ? [] : s.foundToday,
        tonight: a.phase === "night" ? emptyNight() : s.tonight,
        log: log(`Saut à : ${momentOf({ ...s, phase: a.phase, round })}.`),
      };
    }
    case "room": {
      const p = s.players.find((x) => x.id === a.player);
      if (!p || a.room < 1 || a.room > s.players.length) return s;
      const other = s.players.find((x) => x.room === a.room);
      return {
        ...s,
        players: s.players.map((x) => (x.id === p.id ? { ...x, room: a.room } : other && x.id === other.id ? { ...x, room: p.room } : x)),
        log: log(`Correction : ${p.name} passe en chambre ${a.room}${other ? ` (${other.name} prend la ${p.room})` : ""}.`),
      };
    }
    case "intrusion":
      return { ...s, intrusion: a.text, log: a.text ? log("Intrusion de Marga Berlioz dans la simulation.") : s.log };
    case "sound": {
      const slot = def.media.find((m) => m.id === a.slot);
      if (!slot) return s;
      return slot.loop && !s.ambiances.includes(slot.id) ? { ...s, ambiances: [...s.ambiances, slot.id] } : s;
    }
    case "stopSound":
      return { ...s, ambiances: a.slot ? s.ambiances.filter((x) => x !== a.slot) : [] };
    case "record":
      return { ...s, log: log("Enregistrement de la salle : 30 s.") };
    case "fault": {
      const fault = [...def.faults, ...setup.extraFaults].find((f) => f.id === a.id);
      // A fault switched off never goes off, not even by mistake.
      if (!fault || s.faultsOff.includes(fault.id)) return s;
      const next = { ...s, neutral: null, faults: [...s.faults, { id: fault.id, at }], log: log(`Faille : ${fault.title.charAt(0).toLowerCase()}${fault.title.slice(1)}.`) };
      if (fault.kind === "terminalFile" && fault.terminal && fault.file) return { ...next, terminal: fault.terminal, playing: fault.file, circuitShown: false };
      return next;
    }
    case "night": {
      if (s.phase !== "arrival" && s.phase !== "day") return s;
      if (!s.patientZero) return s;
      const round = s.round + 1;
      return {
        ...s,
        phase: "night",
        round,
        terminal: null,
        playing: null,
        circuitShown: false,
        gauge: null,
        timer: null,
        vote: null,
        blizzard: false,
        aurora: false,
        dark: false,
        parity: false,
        confinement: false,
        event: null,
        announced: [],
        lastAction: null,
        tonight: { ...emptyNight(), panic: s.panicNext },
        panicNext: null,
        log: [...s.log, { at: momentOf({ ...s, phase: "night", round }), text: "La nuit tombe." }],
      };
    }
    case "panic":
      // The village names who sleeps in the panic room during the day; the meneur can still change it at night.
      if (s.phase === "night") return { ...s, tonight: { ...s.tonight, panic: a.player, done: [...new Set([...s.tonight.done, "panic" as const])] } };
      return { ...s, panicNext: a.player, log: a.player ? log(`Panic room cette nuit : ${nameOf(s, a.player)}.`) : s.log };
    case "tapes": {
      if (s.phase !== "night") return s;
      const done = [...new Set([...s.tonight.done, "tapes" as const])];
      const target = s.players.find((p) => p.id === a.target);
      if (!target) return { ...s, tonight: { ...s.tonight, done } };
      // Their side as the night began: tonight's contamination only lands at dawn.
      const holder = nameOf(s, s.items.bandes?.holder ?? null);
      return {
        ...s,
        tonight: { ...s.tonight, tapes: { target: target.id, infected: target.infected }, done },
        log: log(`Bandes : ${holder} regarde ${target.name} (${target.infected ? "contaminé" : "sain"}).`),
      };
    }
    case "infect":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, infect: a.player, done: [...new Set([...s.tonight.done, "infect" as const])] } } : s;
    case "victim":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, victim: a.player, done: [...new Set([...s.tonight.done, "victim" as const])] } } : s;
    case "useItem": {
      const item = def.items.find((i) => i.id === a.item);
      const held = s.items[a.item];
      if (!item || !held || held.used || s.locked) return s;
      // The life syringe follows the witch's rule: it saves tonight's victim, and no one else.
      if (item.effect === "life" && (!s.tonight.victim || a.target !== s.tonight.victim || shielded(s, s.tonight.victim, s.chiefResisted))) return s;
      const items = { ...s.items, [a.item]: { ...held, used: true } };
      const by = nameOf(s, held.holder);
      const done = [...new Set([...s.tonight.done, "items" as const])];
      if (item.effect === "life") return { ...s, items, tonight: { ...s.tonight, life: a.target, done }, log: log(`${item.name} (${by}) sur ${nameOf(s, a.target)}.`) };
      if (item.effect === "death") return { ...s, items, tonight: { ...s.tonight, death: a.target, done }, log: log(`${item.name} (${by}) sur ${nameOf(s, a.target)}.`) };
      return { ...s, items, log: log(`${item.name} utilisé.`) };
    }
    case "giveItem": {
      // The syringes go together: one holder for both.
      const ids = a.item === "seringues" ? ["vie", "mort"] : [a.item];
      if (!ids.every((id) => def.items.some((i) => i.id === id))) return s;
      const items = { ...s.items };
      for (const id of ids) items[id] = { holder: a.player, used: s.items[id]?.used ?? false };
      const label = a.item === "seringues" ? "Les seringues" : (def.items.find((i) => i.id === a.item)?.name ?? a.item);
      return { ...s, items, found: [...new Set([...s.found, a.item])], log: log(a.player ? `${label} : ${nameOf(s, a.player)}.` : `${label} : plus personne.`) };
    }
    case "propose":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, proposed: a.events } } : s;
    case "deadChoose":
      return s.phase === "night" ? { ...s, vote: null, timer: null, tonight: { ...s.tonight, chosen: a.event, done: [...new Set([...s.tonight.done, "dead" as const])] } } : s;
    case "skip":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, done: [...new Set([...s.tonight.done, a.step])] } } : s;
    case "dawn": {
      if (s.phase !== "night") return s;
      const n = s.tonight;
      const deaths = dawnDeaths(s);
      // Whatever the pack aims at the chief tonight, contamination or death or both, fails once a loop.
      // (The panic room or the quarantine protect first: then the resistance isn't spent.)
      const chiefHit = !s.chiefResisted && [n.infect, n.victim].some((id) => !!id && shielded(s, id, false) === "chief");
      const resisted = s.chiefResisted || chiefHit;
      const notes: string[] = [];
      if (chiefHit) {
        const both = n.infect === s.chief && n.victim === s.chief;
        notes.push(`Le chef ${nameOf(s, s.chief)} résiste ${both ? "à la double attaque de la meute (contamination et mise à mort)" : n.infect === s.chief ? "à la contamination" : "à l'attaque"} : il perd sa résistance.`);
      }
      let players = s.players.map((p) => (deaths.includes(p.id) ? { ...p, status: "dead" as const, diedAt: at } : p));
      if (n.infect) {
        const shield = shielded(s, n.infect, s.chiefResisted);
        if (shield === "chief") {
          // Noted above.
        } else if (shield) notes.push(`${nameOf(s, n.infect)} est protégé : la contamination échoue.`);
        else {
          // The pack bit together: whoever was in it (and not locked in the panic room) that night.
          const by = pack(s).filter((p) => p.id !== n.panic).map((p) => p.name).join(", ") || null;
          players = players.map((p) => (p.id === n.infect && p.status === "alive" ? { ...p, infected: true, infectedAt: momentOf(s), infectedBy: by } : p));
        }
      }
      const event = setup.events.find((e) => e.id === n.chosen) ?? null;
      const others = n.proposed.filter((id) => id !== n.chosen).map((id) => setup.events.find((e) => e.id === id)?.name).filter(Boolean);
      const line = [
        n.infect ? `Contamination : ${nameOf(s, n.infect)}.` : null,
        `Victime : ${nameOf(s, n.victim)}${n.victim && !deaths.includes(n.victim) ? " (sauvée)" : ""}.`,
        n.panic ? `Panic room : ${nameOf(s, n.panic)}.` : null,
        event ? `Les morts choisissent : ${event.name}${others.length ? ` (contre ${others.join(", ")})` : ""}.` : null,
        ...notes,
      ]
        .filter(Boolean)
        .join(" ");
      const day = { ...s, phase: "day" as const };
      const chiefDied = !!s.chief && deaths.includes(s.chief);
      return {
        ...s,
        phase: "day",
        players,
        chief: chiefDied ? null : s.chief,
        chiefResisted: resisted,
        event: event?.id ?? null,
        eventsPlayed: event ? [...s.eventsPlayed, event.id] : s.eventsPlayed,
        announced: deaths,
        blizzard: event?.effect === "blizzard",
        aurora: event?.effect === "aurora",
        dark: event?.effect === "dark",
        parity: event?.effect === "parity" || event?.effect === "confinement",
        quarantine: [],
        foundToday: [],
        vote: null,
        timer: null,
        lastTest: null,
        lastRadio: null,
        log: [
          ...s.log,
          { at, text: line },
          ...(chiefDied ? [{ at: momentOf(day), text: "Le chef est mort : il transmet son titre." }] : []),
          ...(event ? [{ at: momentOf(day), text: `Événement du jour : ${event.name}.` }] : []),
        ],
      };
    }
    case "exile": {
      if (s.phase !== "day") return s;
      if (!a.player) return { ...s, lastExile: null, log: log("Exil : personne.") };
      const p = s.players.find((x) => x.id === a.player);
      if (!p || p.status !== "alive") return s;
      const wasChief = s.chief === p.id;
      // A healthy chief exiled: « perte de confiance », every power locked until the end of the loop.
      const lockdown = wasChief && !p.infected;
      return {
        ...s,
        players: setPlayer(a.player, { status: "exiled", diedAt: at }),
        chief: dropChief(p.id),
        locked: s.locked || lockdown,
        lastExile: { player: p.id, chief: wasChief, healthy: !p.infected },
        log: [...log(`Exil : ${p.name} (${p.infected ? "contaminé" : "sain"}).`), ...(lockdown ? [{ at, text: "Le chef sain a été exilé : verrouillage général, le village perd tous ses pouvoirs jusqu'à la fin de la boucle." }] : [])],
      };
    }
    case "kill":
      return { ...s, players: setPlayer(a.player, { status: "dead", diedAt: at }), chief: dropChief(a.player), log: log(`Correction : ${nameOf(s, a.player)} est mort.`) };
    case "revive":
      return { ...s, players: setPlayer(a.player, { status: "alive", diedAt: null }), log: log(`Correction : ${nameOf(s, a.player)} est en vie.`) };
    case "setInfected":
      return {
        ...s,
        players: setPlayer(a.player, { infected: a.infected, infectedAt: a.infected ? `${momentOf(s)} (corrigé)` : null }),
        log: log(`Correction : ${nameOf(s, a.player)} ${a.infected ? "contaminé" : "sain"}.`),
      };
    case "endLoop":
      if (s.phase !== "day" && s.phase !== "night") return s;
      return { ...s, phase: "loopEnd", winner: a.winner, terminal: null, playing: null, vote: null, timer: null, log: log(`Fin de boucle : victoire ${a.winner === "village" ? "du village" : "de la meute"}.`) };
    case "reboot": {
      if (s.phase !== "loopEnd") return s;
      if (s.loop >= params.loops) return { ...s, phase: "bad", log: log("Mauvaise fin.") };
      // The base remembers: the rooms of this loop's dead are sealed with their names; what was found stays found.
      const sealed = { ...s.sealed };
      for (const p of s.players) if (p.status !== "alive") sealed[p.room] = p.name;
      const chiefB1 = s.chief ?? s.chiefB1;
      return {
        ...s,
        phase: "bus",
        loop: s.loop + 1,
        round: 0,
        players: s.players.map((p) => ({ ...p, status: "alive", infected: false, infectedAt: null, infectedBy: null, diedAt: null })),
        past: [...s.past, { loop: s.loop, players: s.players.map((p) => ({ id: p.id, status: p.status, at: p.diedAt })) }],
        patientZero: null,
        sealed,
        light: params.hallLitLoop2,
        terminal: null,
        playing: null,
        circuitShown: false,
        // Items stay found; their holders are cleared and their uses reset, to hand them out again.
        items: Object.fromEntries(def.items.map((i) => [i.id, { holder: null, used: false }])),
        roomUsed: { test: false, radio: false },
        chiefB1,
        chief: null,
        chiefToConfirm: !!chiefB1,
        chiefResisted: false,
        locked: false,
        trusted: [],
        lastShot: null,
        lastTest: null,
        lastRadio: null,
        lastExile: null,
        quarantine: [],
        panicNext: null,
        foundToday: [],
        lastAction: null,
        tonight: emptyNight(),
        event: null,
        announced: [],
        gauge: null,
        timer: null,
        vote: null,
        blizzard: false,
        aurora: false,
        dark: false,
        parity: false,
        confinement: false,
        winner: null,
        log: log("Reboot de la simulation."),
      };
    }
    case "goodEnd":
      return { ...s, phase: "good", terminal: null, playing: null, intrusion: null, vote: null, timer: null, log: log("Le village vote contre le meneur : bonne fin.") };
    case "badEnd":
      return { ...s, phase: "bad", terminal: null, playing: null, vote: null, timer: null, log: log("Mauvaise fin.") };

    // ───────── V1.2 ─────────
    case "vote": {
      if (a.options.length === 0) return s;
      const seconds = a.kind === "door" ? (params.voteDoorSeconds ?? 60) : a.kind === "dead" ? (params.voteDeadSeconds ?? 60) : (params.voteChiefSeconds ?? 120);
      const label = a.kind === "door" ? "Choix de la porte" : a.kind === "dead" ? "Le moment des morts" : "Élection du chef de mission";
      const tonight = a.kind === "dead" ? { ...s.tonight, proposed: a.options } : s.tonight;
      return { ...s, vote: { kind: a.kind, options: a.options }, tonight, timer: runTimer(null, "start", when, seconds, label), neutral: null };
    }
    case "voteResult": {
      const kind = s.vote?.kind ?? (s.phase === "night" ? "dead" : "door");
      const base = { ...s, vote: null, timer: null };
      if (!a.choice) return { ...base, log: log("Vote annulé.") };
      if (kind === "door") return doDayAction(def, base, a.choice, at);
      if (kind === "dead")
        return { ...base, tonight: { ...s.tonight, chosen: a.choice, done: [...new Set([...s.tonight.done, "dead" as const])] }, log: log(`Les morts votent : ${setup.events.find((e) => e.id === a.choice)?.name ?? a.choice}.`) };
      return { ...base, chief: a.choice, chiefToConfirm: false, chiefB1: s.loop === 1 ? a.choice : s.chiefB1, log: log(`Chef de mission : ${nameOf(s, a.choice)}.`) };
    }
    case "dayAction":
      return doDayAction(def, s, a.id, at);
    case "labForce":
      return { ...s, doors: { ...s.doors, labo: true }, actionsDone: [...new Set([...s.actionsDone, "labo"])], lastAction: "labo", vote: null, timer: null, log: log("Marga Berlioz force la porte du laboratoire.") };
    case "chief":
      return { ...s, chief: a.player, chiefToConfirm: false, chiefB1: s.loop === 1 && a.player ? a.player : s.chiefB1, log: log(a.player ? `Chef de mission : ${nameOf(s, a.player)}.` : "Plus de chef de mission.") };
    case "chiefConfirm":
      if (!s.chiefB1) return s;
      return { ...s, chief: s.chiefB1, chiefToConfirm: false, log: log(`Chef de mission confirmé : ${nameOf(s, s.chiefB1)}.`) };
    case "shoot": {
      const gun = s.items.pistolet;
      const shooter = gun?.holder ?? null;
      const target = s.players.find((p) => p.id === a.target);
      // One cartridge per loop, by day only, from a living holder; the pistol is a power, locked too.
      if (s.phase !== "day" || !gun || gun.used || !shooter || s.locked || !target || target.status !== "alive" || target.id === shooter) return s;
      if (s.players.find((p) => p.id === shooter)?.status !== "alive") return s;
      const items = { ...s.items, pistolet: { holder: null, used: true } };
      if (target.infected) {
        return {
          ...s,
          items,
          players: setPlayer(target.id, { status: "dead", diedAt: at }),
          chief: dropChief(target.id),
          trusted: [...s.trusted, shooter],
          lastShot: { shooter, target: target.id, infected: true },
          log: log(`Tir du pistolet : ${nameOf(s, shooter)} abat ${target.name} (contaminé). Le tireur passe de confiance.`),
        };
      }
      return {
        ...s,
        items,
        players: s.players.map((p) => (p.id === target.id || p.id === shooter ? { ...p, status: "dead" as const, diedAt: at } : p)),
        chief: s.chief === target.id || s.chief === shooter ? null : s.chief,
        lastShot: { shooter, target: target.id, infected: false },
        log: log(`Tir du pistolet : ${nameOf(s, shooter)} abat ${target.name} (sain). Tir sans motif : le tireur est exclu.`),
      };
    }
    case "bloodTest": {
      const target = s.players.find((p) => p.id === a.target);
      if (!target || s.roomUsed.test || s.locked || !s.found.includes("test")) return s;
      // Incubation: contaminated last night, the test still comes out negative.
      const fresh = target.infectedAt === `Boucle ${s.loop} · Nuit ${s.round}`;
      const positive = target.infected && !fresh;
      return { ...s, roomUsed: { ...s.roomUsed, test: true }, lastTest: { target: target.id, positive }, log: log(`Test sanguin : ${target.name}, ${positive ? "positif" : "négatif"}.`) };
    }
    case "radio": {
      if (s.roomUsed.radio || s.locked || !s.found.includes("radio")) return s;
      const n = pack(s).length;
      return { ...s, roomUsed: { ...s.roomUsed, radio: true }, lastRadio: n, log: log(`Radio : contaminés en vie, ${n}.`) };
    }
    case "quarantine":
      return { ...s, quarantine: a.players.slice(0, 2), log: a.players.length ? log(`Quarantaine : ${a.players.map((id) => nameOf(s, id)).join(" et ")}.`) : s.log };
    case "confinement":
      return {
        ...s,
        confinement: a.on,
        timer: a.on ? runTimer(null, "start", when, params.confinementSeconds ?? 360, "Confinement") : s.timer?.label === "Confinement" ? null : s.timer,
        log: log(a.on ? "Confinement : la base est coupée en deux." : "Porte coupe-feu rouverte."),
      };
    case "flag":
      return { ...s, flags: { ...s.flags, [a.flag]: a.on }, log: log(`Correction : ${flagName(a.flag)} ${a.on ? "trouvé" : "retiré"}.`) };
  }
}

export function replay(def: ScenarioDef, setup: Setup, actions: { action: Action; at: number }[]): State {
  return actions.reduce((s, a) => apply(def, setup, s, a.action, a.at), initialState(def, setup));
}

/** For the bad ending: every fault triggered, with its moment and what it was. */
export function missedClues(def: ScenarioDef, setup: Setup, s: State): { at: string; text: string }[] {
  const all = [...def.faults, ...setup.extraFaults];
  return s.faults.map((f) => ({ at: f.at, text: all.find((x) => x.id === f.id)?.missed ?? f.id }));
}

/** Who contaminated whom, loop by loop: the end-of-evening recap. */
export function recap(s: State): { name: string; room: number; status: PlayerState["status"]; infected: boolean; infectedAt: string | null; by: string | null }[] {
  return s.players.map((p) => ({ name: p.name, room: p.room, status: p.status, infected: p.infected, infectedAt: p.infectedAt, by: p.infectedBy }));
}

const session = (loop: number) => `SESSION ${String(loop).padStart(2, "0")}`;

/** « Boucle 1 · Nuit 2 » → « SESSION 01, NUIT 2 ». */
function whenOf(at: string | null): string {
  const m = at?.match(/Boucle (\d+) · (Nuit|Jour) (\d+)/);
  return m ? `${session(Number(m[1]))}, ${m[2]!.toUpperCase()} ${m[3]}` : (at ?? "").toUpperCase();
}

const statusLine = (status: PlayerState["status"], at: string | null) => (status === "alive" ? "ACTIF" : `${status === "dead" ? "DÉCÉDÉ" : "EXCLU "} (${whenOf(at)})`);

/**
 * SUJETS.DAT, built from the players: each one's status in this loop, and what became of them in the
 * loops before (that's where they understand they've been watched from the start). Never a side, never an item.
 */
export function registry(s: { loop: number; players: { id: string; name: string; room: number; status: PlayerState["status"]; diedAt: string | null }[]; past: State["past"] }): string[] {
  const width = Math.max(8, ...s.players.map((p) => p.name.length)) + 2;
  const lines = [`PROTOCOLE ALPHA — REGISTRE DES SUJETS — ${session(s.loop)}`, ""];
  for (const p of [...s.players].sort((a, b) => a.room - b.room)) {
    const n = String(p.room).padStart(2, "0");
    lines.push(`SUJET ${n}  CH.${n}  ${p.name.toUpperCase().padEnd(width)}STATUT : ${statusLine(p.status, p.diedAt)}`);
    for (const loop of s.past) {
      const then = loop.players.find((x) => x.id === p.id);
      if (then && then.status !== "alive") lines.push(`${" ".repeat(18 + width)}${session(loop.loop)} : ${statusLine(then.status, then.at)}`);
    }
  }
  return lines;
}

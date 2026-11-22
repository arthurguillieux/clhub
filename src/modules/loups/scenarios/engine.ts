/**
 * A scenario evening, played from its journal: every gesture of the console is an action, and the
 * state is rebuilt from the list. « Annuler » removes the last action; nothing else can go stale.
 * Pure functions on plain values: the console proposes, the meneur confirms.
 */
import type { DayEvent, Fault, ScenarioDef, ScenarioParams } from "./types";

export interface Setup {
  players: { id: string; name: string }[];
  params: ScenarioParams;
  events: DayEvent[];
  extraFaults: Fault[];
  /** Per terminal file: the name and date shown, a text file's words, subtitles (« 0:03 Réplique » per line). */
  files?: Record<string, { name?: string; date?: string; text?: string; subs?: string }>;
  /** The HUD's in-world date and the real one a fault shows. */
  dates?: { world?: string; real?: string };
}

export type Action =
  | { t: "start" }
  | { t: "arrive" }
  | { t: "patientZero"; player: string }
  | { t: "light"; on: boolean }
  | { t: "cut" }
  | { t: "door"; door: string; open: boolean }
  | { t: "terminal"; id: string | null }
  | { t: "play"; file: string }
  | { t: "circuit"; show: boolean }
  | { t: "switch"; index: number; up: boolean }
  | { t: "power" }
  | { t: "glitch" }
  | { t: "blizzard"; on: boolean }
  | { t: "aurora"; on: boolean }
  | { t: "gauge"; seconds: number | null }
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
  | { t: "badEnd" };

export type Phase = "welcome" | "bus" | "arrival" | "night" | "day" | "loopEnd" | "good" | "bad";
export type NightStepId = "panic" | "tapes" | "infect" | "victim" | "items" | "dead";

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
  /** The generators' gauge: its length in seconds and when it started (ms), for the projection to time it. */
  gauge: { seconds: number; at: number } | null;
  intrusion: string | null;
  /** Looping sounds playing on the projection. */
  ambiances: string[];
  items: Record<string, { holder: string | null; used: boolean }>;
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
  /** Deaths announced this morning, for the projection. */
  announced: string[];
  faults: { id: string; at: string }[];
  /** The loops gone by: who died or was exiled, and when (for SUJETS.DAT). */
  past: { loop: number; players: { id: string; status: PlayerState["status"]; at: string | null }[] }[];
  winner: "village" | "meute" | null;
  log: { at: string; text: string }[];
}

const emptyNight = (): State["tonight"] => ({ panic: null, infect: null, victim: null, life: null, death: null, tapes: null, proposed: [], chosen: null, done: [] });

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
    gauge: null,
    intrusion: null,
    ambiances: [],
    items: Object.fromEntries(def.items.map((i) => [i.id, { holder: null, used: false }])),
    tonight: emptyNight(),
    event: null,
    announced: [],
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

/** The steps of tonight's wizard, in order. */
export function nightSteps(s: State, params: ScenarioParams): NightStepId[] {
  const steps: NightStepId[] = [];
  const holderAlive = (id: string) => {
    const held = s.items[id];
    return !!held && !held.used && !!held.holder && s.players.find((p) => p.id === held.holder)?.status === "alive";
  };
  if (s.panicReady) steps.push("panic");
  // The tapes are used every night while their holder lives: they're never spent.
  if (holderAlive("bandes")) steps.push("tapes");
  if (contagionActive(s, params)) steps.push("infect");
  steps.push("victim");
  if (holderAlive("vie") || holderAlive("mort")) steps.push("items");
  steps.push("dead");
  return steps;
}

/** Who dies at dawn: the victim (unless in the panic room or saved), the death syringe's target. */
export function dawnDeaths(s: State): string[] {
  const n = s.tonight;
  const out: string[] = [];
  if (n.victim && n.victim !== n.panic && n.victim !== n.life) out.push(n.victim);
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

/** Days' events to propose to the dead: the next ones in the list, those already played tonight's loop last. */
export function proposals(s: State, setup: Setup): string[] {
  const n = Math.max(1, Math.min(setup.events.length, setup.params.eventsProposed));
  const played = new Set(s.log.filter((l) => l.text.startsWith("Événement du jour")).map((l) => l.text));
  const fresh = setup.events.filter((e) => ![...played].some((t) => t.includes(e.name)));
  const pool = [...fresh, ...setup.events.filter((e) => !fresh.includes(e))];
  const start = (s.round - 1 + (s.loop - 1) * 2) % Math.max(1, pool.length);
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, n).map((e) => e.id);
}

const nameOf = (s: State, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "personne";

/** One action applied. Unknown or impossible actions leave the state as it was. */
export function apply(def: ScenarioDef, setup: Setup, s: State, a: Action, when = 0): State {
  const at = momentOf(s);
  const log = (text: string): State["log"] => [...s.log, { at, text }];
  const setPlayer = (id: string, change: Partial<PlayerState>) => s.players.map((p) => (p.id === id ? { ...p, ...change } : p));
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
      if (door.locked) return { ...s, log: log(`Porte ${door.letter} ${door.label} : accès refusé.`) };
      return { ...s, doors: { ...s.doors, [a.door]: a.open }, log: log(`Porte ${a.open ? "ouverte" : "fermée"} : ${door.letter} ${door.label}.`) };
    }
    case "terminal": {
      const term = def.terminals.find((x) => x.id === a.id);
      return { ...s, terminal: term ? term.id : null, playing: null, circuitShown: false, log: term ? log(`Terminal ouvert : ${term.label}.`) : s.log };
    }
    case "play": {
      const term = def.terminals.find((x) => x.id === s.terminal);
      const file = term?.files.find((f) => f.id === a.file);
      if (!file) return s;
      return { ...s, playing: file.id, log: log(`Fichier lancé : ${file.name}.`) };
    }
    case "circuit":
      return { ...s, circuitShown: a.show, terminal: a.show ? null : s.terminal, playing: null };
    case "switch": {
      if (a.index < 0 || a.index > 3) return s;
      const switches = [...s.switches] as State["switches"];
      switches[a.index] = a.up;
      return { ...s, switches };
    }
    case "power": {
      const ok = s.switches.every((v, i) => v === setup.params.circuit[i]);
      return { ...s, circuitShown: true, panicReady: s.panicReady || ok, lastPower: ok, log: log(ok ? "Circuit : panic room opérationnelle." : "Circuit : court-circuit.") };
    }
    case "glitch":
      return { ...s, log: log("Effet : faille.") };
    case "blizzard":
      return { ...s, blizzard: a.on };
    case "aurora":
      return { ...s, aurora: a.on };
    case "gauge":
      return { ...s, gauge: a.seconds ? { seconds: a.seconds, at: when } : null };
    case "intrusion":
      return { ...s, intrusion: a.text, log: a.text ? log("Intrusion dans la simulation.") : s.log };
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
      if (!fault) return s;
      const next = { ...s, faults: [...s.faults, { id: fault.id, at }], log: log(`Faille : ${fault.title.charAt(0).toLowerCase()}${fault.title.slice(1)}.`) };
      if (fault.kind === "terminalFile" && fault.terminal && fault.file) return { ...next, terminal: fault.terminal, playing: fault.file, circuitShown: false };
      return next;
    }
    case "night": {
      if (s.phase !== "arrival" && s.phase !== "day") return s;
      if (!s.patientZero) return s;
      const round = s.round + 1;
      return { ...s, phase: "night", round, terminal: null, playing: null, circuitShown: false, gauge: null, blizzard: false, aurora: false, event: null, announced: [], tonight: emptyNight(), log: [...s.log, { at: momentOf({ ...s, phase: "night", round }), text: "La nuit tombe." }] };
    }
    case "panic":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, panic: a.player, done: [...new Set([...s.tonight.done, "panic" as const])] } } : s;
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
    case "infect": {
      if (s.phase !== "night") return s;
      const tonight = { ...s.tonight, infect: a.player, done: [...new Set([...s.tonight.done, "infect" as const])] };
      return { ...s, tonight };
    }
    case "victim":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, victim: a.player, done: [...new Set([...s.tonight.done, "victim" as const])] } } : s;
    case "useItem": {
      const item = def.items.find((i) => i.id === a.item);
      const held = s.items[a.item];
      if (!item || !held || held.used) return s;
      // The life syringe follows the witch's rule: it saves tonight's victim, and no one else.
      if (item.effect === "life" && (!s.tonight.victim || a.target !== s.tonight.victim || s.tonight.victim === s.tonight.panic)) return s;
      const items = { ...s.items, [a.item]: { ...held, used: true } };
      const by = nameOf(s, held.holder);
      if (item.effect === "life") return { ...s, items, tonight: { ...s.tonight, life: a.target, done: [...new Set([...s.tonight.done, "items" as const])] }, log: log(`${item.name} (${by}) sur ${nameOf(s, a.target)}.`) };
      if (item.effect === "death") return { ...s, items, tonight: { ...s.tonight, death: a.target, done: [...new Set([...s.tonight.done, "items" as const])] }, log: log(`${item.name} (${by}) sur ${nameOf(s, a.target)}.`) };
      if (item.effect === "pistol" && a.target) return { ...s, items, players: setPlayer(a.target, { status: "dead", diedAt: at }), log: log(`${item.name} : ${by} abat ${nameOf(s, a.target)}.`) };
      return { ...s, items, log: log(`${item.name} utilisée.`) };
    }
    case "giveItem": {
      const item = def.items.find((i) => i.id === a.item);
      if (!item) return s;
      return { ...s, items: { ...s.items, [a.item]: { holder: a.player, used: s.items[a.item]?.used ?? false } }, log: log(a.player ? `${item.name} confiée à ${nameOf(s, a.player)}.` : `${item.name} : plus personne.`) };
    }
    case "propose":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, proposed: a.events } } : s;
    case "deadChoose":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, chosen: a.event, done: [...new Set([...s.tonight.done, "dead" as const])] } } : s;
    case "skip":
      return s.phase === "night" ? { ...s, tonight: { ...s.tonight, done: [...new Set([...s.tonight.done, a.step])] } } : s;
    case "dawn": {
      if (s.phase !== "night") return s;
      const n = s.tonight;
      const deaths = dawnDeaths(s);
      let players = s.players.map((p) => (deaths.includes(p.id) ? { ...p, status: "dead" as const, diedAt: at } : p));
      if (n.infect) {
        // The pack bit together: whoever was in it (and not locked in the panic room) that night.
        const by = pack(s).filter((p) => p.id !== n.panic).map((p) => p.name).join(", ") || null;
        players = players.map((p) => (p.id === n.infect && p.status === "alive" ? { ...p, infected: true, infectedAt: momentOf(s), infectedBy: by } : p));
      }
      const event = setup.events.find((e) => e.id === n.chosen) ?? null;
      const others = n.proposed.filter((id) => id !== n.chosen).map((id) => setup.events.find((e) => e.id === id)?.name).filter(Boolean);
      const line = [
        n.infect ? `Contamination : ${nameOf(s, n.infect)}.` : null,
        `Victime : ${nameOf(s, n.victim)}${n.victim && !deaths.includes(n.victim) ? " (sauvée)" : ""}.`,
        n.panic ? `Panic room : ${nameOf(s, n.panic)}.` : null,
        event ? `Les morts choisissent : ${event.name}${others.length ? ` (contre ${others.join(", ")})` : ""}.` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const day = { ...s, phase: "day" as const };
      return {
        ...s,
        phase: "day",
        players,
        event: event?.id ?? null,
        announced: deaths,
        blizzard: event?.effect === "blizzard",
        aurora: event?.effect === "aurora",
        log: [...s.log, { at, text: line }, ...(event ? [{ at: momentOf(day), text: `Événement du jour : ${event.name}.` }] : [])],
      };
    }
    case "exile": {
      if (s.phase !== "day") return s;
      if (!a.player) return { ...s, log: log("Exil : personne.") };
      const p = s.players.find((x) => x.id === a.player);
      if (!p || p.status !== "alive") return s;
      return { ...s, players: setPlayer(a.player, { status: "exiled", diedAt: at }), log: log(`Exil : ${p.name} (${p.infected ? "contaminé" : "sain"}).`) };
    }
    case "kill":
      return { ...s, players: setPlayer(a.player, { status: "dead", diedAt: at }), log: log(`Correction : ${nameOf(s, a.player)} est mort.`) };
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
      return { ...s, phase: "loopEnd", winner: a.winner, terminal: null, playing: null, log: log(`Fin de boucle : victoire ${a.winner === "village" ? "du village" : "de la meute"}.`) };
    case "reboot": {
      if (s.phase !== "loopEnd") return s;
      if (s.loop >= setup.params.loops) return { ...s, phase: "bad", log: log("Mauvaise fin.") };
      // The base remembers: the rooms of this loop's dead are sealed with their names.
      const sealed = { ...s.sealed };
      for (const p of s.players) if (p.status !== "alive") sealed[p.room] = p.name;
      return {
        ...s,
        phase: "bus",
        loop: s.loop + 1,
        round: 0,
        players: s.players.map((p) => ({ ...p, status: "alive", infected: false, infectedAt: null, infectedBy: null, diedAt: null })),
        past: [...s.past, { loop: s.loop, players: s.players.map((p) => ({ id: p.id, status: p.status, at: p.diedAt })) }],
        patientZero: null,
        sealed,
        light: setup.params.hallLitLoop2,
        terminal: null,
        playing: null,
        circuitShown: false,
        items: Object.fromEntries(def.items.map((i) => [i.id, { holder: null, used: false }])),
        tonight: emptyNight(),
        event: null,
        announced: [],
        gauge: null,
        blizzard: false,
        aurora: false,
        winner: null,
        log: log("Reboot de la simulation."),
      };
    }
    case "goodEnd":
      return { ...s, phase: "good", terminal: null, playing: null, intrusion: null, log: log("Le village vote contre le meneur : bonne fin.") };
    case "badEnd":
      return { ...s, phase: "bad", terminal: null, playing: null, log: log("Mauvaise fin.") };
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
function when(at: string | null): string {
  const m = at?.match(/Boucle (\d+) · (Nuit|Jour) (\d+)/);
  return m ? `${session(Number(m[1]))}, ${m[2]!.toUpperCase()} ${m[3]}` : (at ?? "").toUpperCase();
}

const statusLine = (status: PlayerState["status"], at: string | null) =>
  status === "alive" ? "ACTIF" : `${status === "dead" ? "DÉCÉDÉ" : "EXCLU "} (${when(at)})`;

/**
 * SUJETS.DAT, built from the players: each one's status in this loop, and what became of them in the
 * loops before (that's where they understand they've been watched from the start). Never a side.
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

/**
 * The meneur's memory during a game: whose turn it is at night, what happened, who dies at dawn
 * and what follows from it (lovers, the wild child, the hunter…), and whether a side has won.
 * The CLHUB proposes; the meneur confirms. Pure functions on plain values.
 */
import { roleName, type RoleId } from "./roles";
import type { Deck } from "./deck";

export interface Seat {
  id: string;
  name: string;
  /** Around the table, from the meneur's left: neighbours matter (bear tamer, knight). */
  position: number;
  /** null until the meneur knows it (physical cards). */
  role: RoleId | null;
  alive: boolean;
  diedTurn: number | null;
  /** 1 for the first one out, and so on. */
  deathOrder: number | null;
}

export type Winner = "village" | "loups" | "amoureux" | "loupblanc" | "personne";

export const WINNER_LABELS: Record<Winner, string> = {
  village: "Victoire du village",
  loups: "Victoire des loups-garous",
  amoureux: "Victoire des amoureux",
  loupblanc: "Victoire du loup blanc",
  personne: "Personne ne gagne",
};

export interface Tonight {
  protected: string | null;
  victim: string | null;
  infect: boolean;
  heal: boolean;
  poison: string | null;
  whiteWolf: string | null;
  /** Steps the meneur ticked off this night. */
  done: string[];
}

export interface Tracker {
  /** 1 = first night, 2 = first day, 3 = second night… */
  turn: number;
  lovers: [string, string] | null;
  model: string | null;
  /** The wild child's model died: they're a wolf now. */
  transformed: boolean;
  /** Turned into wolves by the infect père des loups. */
  infected: string[];
  lastProtected: string | null;
  tonight: Tonight;
  used: { heal: boolean; poison: boolean; infect: boolean; barbier: boolean; juge: boolean; servante: boolean };
  /** The ancien already survived the wolves once. */
  elderHit: boolean;
  idiotSpared: boolean;
  /** Nobody woke up at the wolves' call: « peste noire », the meneur kills at night. */
  plague: boolean;
  deaths: number;
  log: { turn: number; text: string }[];
}

const emptyNight = (): Tonight => ({ protected: null, victim: null, infect: false, heal: false, poison: null, whiteWolf: null, done: [] });

export function newTracker(): Tracker {
  return {
    turn: 1,
    lovers: null,
    model: null,
    transformed: false,
    infected: [],
    lastProtected: null,
    tonight: emptyNight(),
    used: { heal: false, poison: false, infect: false, barbier: false, juge: false, servante: false },
    elderHit: false,
    idiotSpared: false,
    plague: false,
    deaths: 0,
    log: [],
  };
}

export const isNight = (turn: number) => turn % 2 === 1;
export const phaseLabel = (turn: number) => (isNight(turn) ? `Nuit ${(turn + 1) / 2}` : `Jour ${turn / 2}`);

/** Plays with the wolves at this point of the game: their cards, the infected, the wild child once turned. */
export function isWolf(seat: Seat, t: Tracker): boolean {
  if (seat.role === "loup" || seat.role === "infect" || seat.role === "loupblanc") return true;
  if (t.infected.includes(seat.id)) return true;
  return seat.role === "enfant" && t.transformed;
}

const nameOf = (seats: Seat[], id: string | null) => seats.find((s) => s.id === id)?.name ?? "?";

// ───────── The night ─────────

export type StepId = "cupidon" | "amoureux" | "soeur" | "enfant" | "voyante" | "renard" | "salvateur" | "corbeau" | "loups" | "infect" | "loupblanc" | "sorciere";

export interface NightStep {
  id: StepId;
  /** The card called: its holders must be alive for the step to come up. */
  role: RoleId;
  label: string;
  hint: string;
  firstNightOnly?: boolean;
}

/** The usual order of the calls. The meneur can rearrange it; their order is kept with the game. */
export const NIGHT_STEPS: NightStep[] = [
  { id: "cupidon", role: "cupidon", label: "Cupidon", hint: "Il désigne les deux amoureux, puis se rendort.", firstNightOnly: true },
  { id: "amoureux", role: "cupidon", label: "Les amoureux", hint: "Tu touches les deux amoureux : ils se reconnaissent, puis se rendorment.", firstNightOnly: true },
  { id: "soeur", role: "soeur", label: "Les sœurs", hint: "Elles se reconnaissent.", firstNightOnly: true },
  { id: "enfant", role: "enfant", label: "L'enfant sauvage", hint: "Il choisit son modèle.", firstNightOnly: true },
  { id: "voyante", role: "voyante", label: "La voyante", hint: "Elle désigne un joueur et tu lui montres sa carte." },
  { id: "renard", role: "renard", label: "Le renard", hint: "Il désigne trois voisins : y a-t-il un loup parmi eux ?" },
  { id: "salvateur", role: "salvateur", label: "Le salvateur", hint: "Il protège un joueur, jamais le même deux nuits de suite." },
  { id: "corbeau", role: "corbeau", label: "Le corbeau", hint: "Il désigne un joueur qui aura deux voix contre lui demain." },
  { id: "loups", role: "loup", label: "Les loups-garous", hint: "Ils se mettent d'accord sur une victime." },
  { id: "infect", role: "infect", label: "L'infect père des loups", hint: "Une fois dans la partie, il peut infecter la victime au lieu de la tuer." },
  { id: "loupblanc", role: "loupblanc", label: "Le loup blanc", hint: "Une nuit sur deux, il peut dévorer un loup-garou." },
  { id: "sorciere", role: "sorciere", label: "La sorcière", hint: "Tu lui montres la victime : potion de vie, potion de mort, ou rien." },
];

/** The steps in the meneur's order: theirs first, then any they never placed, at their usual spot. */
export function orderedSteps(order: string[] | null): NightStep[] {
  if (!order?.length) return NIGHT_STEPS;
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length + NIGHT_STEPS.findIndex((s) => s.id === id) / 100 : i;
  };
  return [...NIGHT_STEPS].sort((a, b) => rank(a.id) - rank(b.id));
}

/** Whether a card can still act: in the deck, and (when the meneur knows who has it) someone alive holds it. */
function inPlay(role: RoleId, deck: Deck, seats: Seat[]): boolean {
  if ((deck[role] ?? 0) === 0) return false;
  const holders = seats.filter((s) => s.role === role);
  const unknown = seats.some((s) => s.role === null && s.alive);
  return holders.some((s) => s.alive) || (holders.length < (deck[role] ?? 0) && unknown);
}

/** Tonight's calls: dead cards and spent powers are left out. */
export function nightSteps(seats: Seat[], deck: Deck, t: Tracker, order: string[] | null): NightStep[] {
  const night = (t.turn + 1) / 2;
  return orderedSteps(order).filter((step) => {
    if (step.firstNightOnly && night !== 1) return false;
    switch (step.id) {
      case "loups":
        return !t.plague && (seats.some((s) => s.alive && isWolf(s, t)) || seats.some((s) => s.alive && s.role === null));
      case "infect":
        return !t.used.infect && inPlay("infect", deck, seats);
      case "loupblanc":
        return night % 2 === 0 && inPlay("loupblanc", deck, seats);
      case "sorciere":
        return (!t.used.heal || !t.used.poison) && inPlay("sorciere", deck, seats);
      default:
        return inPlay(step.role, deck, seats);
    }
  });
}

// ───────── Deaths and what follows ─────────

export type Cause = "loups" | "sorciere" | "loupblanc" | "vote" | "barbier" | "chagrin" | "chasseur" | "meneur" | "autre";

export const CAUSE_LABELS: Record<Cause, string> = {
  loups: "dévoré par les loups",
  sorciere: "empoisonné par la sorcière",
  loupblanc: "dévoré par le loup blanc",
  vote: "éliminé par le village",
  barbier: "tué par le barbier",
  chagrin: "mort de chagrin",
  chasseur: "abattu par le chasseur",
  meneur: "tué par le meneur (peste noire)",
  autre: "mort",
};

export interface Death {
  seat: string;
  cause: Cause;
}

/** These deaths, and the ones they bring: a lover never outlives the other. */
export function withCascade(seats: Seat[], t: Tracker, deaths: Death[]): Death[] {
  const out = [...deaths];
  const dying = () => new Set(out.map((d) => d.seat));
  for (let changed = true; changed; ) {
    changed = false;
    if (t.lovers) {
      const [a, b] = t.lovers;
      for (const [one, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const otherAlive = seats.find((s) => s.id === other)?.alive;
        if (dying().has(one) && !dying().has(other) && otherAlive) {
          out.push({ seat: other, cause: "chagrin" });
          changed = true;
        }
      }
    }
  }
  return out.filter((d, i) => out.findIndex((x) => x.seat === d.seat) === i && seats.find((s) => s.id === d.seat)?.alive);
}

/** What the meneur should know or do once these players are gone. */
export function aftermath(seats: Seat[], t: Tracker, deaths: Death[]): string[] {
  const notes: string[] = [];
  const role = (id: string) => seats.find((s) => s.id === id)?.role ?? null;
  for (const d of deaths) {
    const r = role(d.seat);
    if (r === "chasseur") notes.push(`${nameOf(seats, d.seat)} était chasseur : il tire sur quelqu'un avant de mourir.`);
    if (r === "ancien" && d.cause !== "loups") notes.push("L'ancien a été tué par le village : les villageois perdent leurs pouvoirs.");
    if (r === "chevalier" && d.cause === "loups") notes.push("Le chevalier est mort dévoré : le premier loup à sa gauche mourra la nuit prochaine.");
    if (t.model === d.seat && !t.transformed && seats.some((s) => s.role === "enfant" && s.alive))
      notes.push("Le modèle de l'enfant sauvage est mort : l'enfant devient loup-garou. Réveille-le avec les loups.");
  }
  return notes;
}

export interface Dawn {
  deaths: Death[];
  notes: string[];
  elderHit: boolean;
  infected: string | null;
}

/** What the night leaves at dawn. */
export function dawn(seats: Seat[], t: Tracker): Dawn {
  const n = t.tonight;
  const deaths: Death[] = [];
  const notes: string[] = [];
  let elderHit = t.elderHit;
  let infected: string | null = null;
  const victim = n.victim;
  if (victim) {
    const who = nameOf(seats, victim);
    const card = seats.find((s) => s.id === victim)?.role;
    if (n.protected === victim) notes.push(`${who} était protégé par le salvateur : les loups repartent bredouilles.`);
    else if (n.heal) notes.push(`${who} a été sauvé par la sorcière.`);
    else if (n.infect) {
      infected = victim;
      notes.push(`${who} est infecté : il survit, mais joue désormais avec les loups.`);
    } else if (card === "ancien" && !t.elderHit) {
      elderHit = true;
      notes.push(`${who} est l'ancien : il résiste à cette première attaque.`);
    } else deaths.push({ seat: victim, cause: t.plague ? "meneur" : "loups" });
  }
  if (n.poison) deaths.push({ seat: n.poison, cause: "sorciere" });
  if (n.whiteWolf) deaths.push({ seat: n.whiteWolf, cause: "loupblanc" });
  const all = withCascade(seats, t, deaths);
  return { deaths: all, notes: [...notes, ...aftermath(seats, t, all)], elderHit, infected };
}

/** The barbier strikes: a wolf dies alone, anyone else takes the barbier with them. */
export function barberStrike(seats: Seat[], t: Tracker, barber: string, target: string): Death[] {
  const victim = seats.find((s) => s.id === target);
  const deaths: Death[] = [{ seat: target, cause: "barbier" }];
  if (victim && !isWolf(victim, t)) deaths.push({ seat: barber, cause: "barbier" });
  return withCascade(seats, t, deaths);
}

/** The village votes someone out. The idiot is spared once; the servante may take the card first. */
export function voteOut(seats: Seat[], t: Tracker, target: string): { deaths: Death[]; spared: boolean } {
  const victim = seats.find((s) => s.id === target);
  if (victim?.role === "idiot" && !t.idiotSpared) return { deaths: [], spared: true };
  return { deaths: withCascade(seats, t, [{ seat: target, cause: "vote" }]), spared: false };
}

/** The deaths, written down: who, when, in what order, and what changes with them. */
export function applyDeaths(seats: Seat[], t: Tracker, deaths: Death[]): { seats: Seat[]; tracker: Tracker } {
  let count = t.deaths;
  const byId = new Map(deaths.map((d) => [d.seat, d]));
  const next = seats.map((s) => {
    if (!byId.has(s.id) || !s.alive) return s;
    count += 1;
    return { ...s, alive: false, diedTurn: t.turn, deathOrder: count };
  });
  const lines = deaths
    .filter((d) => seats.find((s) => s.id === d.seat)?.alive)
    .map((d) => {
      const s = seats.find((x) => x.id === d.seat);
      return `${s?.name ?? "?"} (${roleName(s?.role)}) : ${CAUSE_LABELS[d.cause]}.`;
    });
  const transformed = t.transformed || (!!t.model && byId.has(t.model) && seats.some((s) => s.role === "enfant" && s.alive && !byId.has(s.id)));
  return {
    seats: next,
    tracker: { ...t, deaths: count, transformed, log: [...t.log, ...lines.map((text) => ({ turn: t.turn, text }))] },
  };
}

/** From night to day: the night's events are settled, the salvateur's choice is remembered. */
export function toDay(t: Tracker, d: Dawn, seats: Seat[]): Tracker {
  const n = t.tonight;
  const lines: string[] = [];
  if (n.victim) lines.push(`Les loups ont visé ${nameOf(seats, n.victim)}.`);
  if (n.protected) lines.push(`Le salvateur a protégé ${nameOf(seats, n.protected)}.`);
  if (n.heal) lines.push("La sorcière a utilisé sa potion de vie.");
  if (n.poison) lines.push(`La sorcière a empoisonné ${nameOf(seats, n.poison)}.`);
  if (d.infected) lines.push(`${nameOf(seats, d.infected)} a été infecté.`);
  return {
    ...t,
    turn: t.turn + 1,
    elderHit: d.elderHit,
    infected: d.infected ? [...t.infected, d.infected] : t.infected,
    lastProtected: n.protected,
    used: { ...t.used, heal: t.used.heal || n.heal, poison: t.used.poison || !!n.poison, infect: t.used.infect || n.infect },
    tonight: emptyNight(),
    log: [...t.log, ...lines.map((text) => ({ turn: t.turn, text }))],
  };
}

export function toNight(t: Tracker): Tracker {
  return { ...t, turn: t.turn + 1, tonight: emptyNight() };
}

// ───────── The end ─────────

/** The side that has won, when it's clear; null while the game goes on or the meneur doesn't know all the cards. */
export function outcome(seats: Seat[], t: Tracker): Winner | null {
  const alive = seats.filter((s) => s.alive);
  if (alive.length === 0) return "personne";
  if (alive.some((s) => s.role === null)) return null;
  if (t.lovers && alive.length === 2 && t.lovers.every((id) => alive.some((s) => s.id === id))) {
    const [a, b] = alive;
    if (a && b && isWolf(a, t) !== isWolf(b, t)) return "amoureux";
  }
  if (alive.length === 1 && alive[0]?.role === "loupblanc") return "loupblanc";
  const wolves = alive.filter((s) => isWolf(s, t));
  if (wolves.length === 0) return seats.some((s) => isWolf(s, t)) ? "village" : null;
  if (wolves.length === alive.length) return "loups";
  return null;
}

/** Seats whose card would be a wolf, for a meneur who deals with the CLHUB: none drawn means « peste noire ». */
export const noWolfDrawn = (seats: Seat[]) => seats.every((s) => s.role !== null && s.role !== "loup" && s.role !== "infect" && s.role !== "loupblanc");

// ───────── Stats ─────────

export interface PlayedSeat {
  playerId: string;
  name: string;
  alive: boolean;
  diedTurn: number | null;
  deathOrder: number | null;
  /** The game's last turn. */
  lastTurn: number;
  /** Their side won the game. */
  won?: boolean;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  games: number;
  /** Alive when the game ended. */
  survived: number;
  /** First one out of their game. */
  firstOut: number;
  /** Turns (nights and days) lived, on average: the higher, the longer they lasted. */
  averageTurns: number;
  /** Games their side won. */
  wins: number;
}

/** Per player, in alphabetical order: no podium in the club. */
export function playerStats(rows: PlayedSeat[]): PlayerStats[] {
  const by = new Map<string, PlayerStats & { turns: number }>();
  for (const r of rows) {
    const s = by.get(r.playerId) ?? { playerId: r.playerId, name: r.name, games: 0, survived: 0, firstOut: 0, averageTurns: 0, wins: 0, turns: 0 };
    s.games += 1;
    if (r.won) s.wins += 1;
    if (r.alive) s.survived += 1;
    if (r.deathOrder === 1) s.firstOut += 1;
    s.turns += r.alive ? r.lastTurn : (r.diedTurn ?? r.lastTurn);
    by.set(r.playerId, s);
  }
  return [...by.values()]
    .map(({ turns, ...s }) => ({ ...s, averageTurns: Math.round((turns / s.games) * 10) / 10 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Whether this seat's side won: the lovers, the white wolf, the pack (the infected and a turned wild child too), or the village. */
export function seatWon(seat: Seat, t: Tracker, winner: Winner): boolean {
  if (winner === "personne") return false;
  if (winner === "amoureux") return !!t.lovers?.includes(seat.id);
  if (winner === "loupblanc") return seat.role === "loupblanc";
  const wolf = isWolf(seat, t) && seat.role !== "loupblanc";
  return winner === "loups" ? wolf : !isWolf(seat, t);
}

export interface PlayedGame {
  startedAt: Date | null;
  endedAt: Date | null;
  winner: Winner;
  blackPlague: boolean;
  players: number;
  /** The game's last turn: 1 = first night, 2 = first day… */
  lastTurn: number;
}

export interface Activity {
  games: number;
  evenings: number;
  /** Games per evening, players per game, nights per game, minutes per game (null: no game timed). */
  perEvening: number;
  players: number;
  nights: number;
  minutes: number | null;
  /** Share of each outcome, in percent (rounded), in WINNER_LABELS' order. */
  shares: { winner: Winner; games: number; percent: number }[];
  blackPlagues: number;
}

/** Two games more than six hours apart belong to two evenings. */
const EVENING_GAP_MS = 6 * 3600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The table's activity: how much, how long, who wins. */
export function activity(games: PlayedGame[]): Activity {
  const timed = games.filter((g) => g.startedAt && g.endedAt && g.endedAt > g.startedAt);
  const starts = games.map((g) => (g.startedAt ?? g.endedAt)?.getTime()).filter((x): x is number => x !== undefined).sort((a, b) => a - b);
  const evenings = starts.reduce((n, at, i) => (i === 0 || at - starts[i - 1]! > EVENING_GAP_MS ? n + 1 : n), 0);
  const count = (w: Winner) => games.filter((g) => g.winner === w).length;
  const n = Math.max(1, games.length);
  return {
    games: games.length,
    evenings,
    perEvening: evenings ? round1(games.length / evenings) : 0,
    players: round1(games.reduce((s, g) => s + g.players, 0) / n),
    nights: round1(games.reduce((s, g) => s + Math.ceil(g.lastTurn / 2), 0) / n),
    minutes: timed.length ? Math.round(timed.reduce((s, g) => s + (g.endedAt!.getTime() - g.startedAt!.getTime()), 0) / timed.length / 60_000) : null,
    shares: (Object.keys(WINNER_LABELS) as Winner[]).map((w) => ({ winner: w, games: count(w), percent: Math.round((count(w) / n) * 100) })).filter((x) => x.games > 0),
    blackPlagues: games.filter((g) => g.blackPlague).length,
  };
}

import { describe, expect, it } from "vitest";
import { suggestDeck } from "./deck";
import {
  applyDeaths,
  barberStrike,
  dawn,
  newTracker,
  nightSteps,
  orderedSteps,
  outcome,
  phaseLabel,
  playerStats,
  activity,
  seatWon,
  type PlayedGame,
  type Winner,
  toDay,
  toNight,
  voteOut,
  withCascade,
  type Seat,
  type Tracker,
} from "./game";
import type { RoleId } from "./roles";

const seat = (id: string, role: RoleId | null, more: Partial<Seat> = {}): Seat => ({ id, name: id, position: 0, role, alive: true, diedTurn: null, deathOrder: null, ...more });
const night = (t: Tracker, tonight: Partial<Tracker["tonight"]>): Tracker => ({ ...t, tonight: { ...t.tonight, ...tonight } });

const table = () => [
  seat("Léa", "loup"),
  seat("Hugo", "loup"),
  seat("Inès", "sorciere"),
  seat("Tom", "salvateur"),
  seat("Zoé", "ancien"),
  seat("Noé", "cupidon"),
  seat("Max", "enfant"),
  seat("Eva", "barbier"),
  seat("Lou", "idiot"),
];

describe("the night's calls", () => {
  it("calls Cupidon, the lovers and the wild child on the first night only", () => {
    const deck = suggestDeck(9, false);
    const t = newTracker();
    expect(nightSteps(table(), deck, t, null).map((s) => s.id)).toEqual(["cupidon", "amoureux", "enfant", "salvateur", "loups", "sorciere"]);
    expect(nightSteps(table(), deck, toNight(toDay(t, dawn(table(), t), table())), null).map((s) => s.id)).toEqual(["salvateur", "loups", "sorciere"]);
  });

  it("drops a dead card and a witch with no potion left", () => {
    const deck = suggestDeck(9, false);
    const seats = table().map((s) => (s.id === "Tom" ? { ...s, alive: false } : s));
    const t = { ...newTracker(), turn: 3, used: { ...newTracker().used, heal: true, poison: true } };
    expect(nightSteps(seats, deck, t, null).map((s) => s.id)).toEqual(["loups"]);
  });

  it("keeps calling a card nobody was found with yet (physical cards)", () => {
    const seats = [seat("A", null), seat("B", null), seat("C", null), seat("D", null), seat("E", null)];
    expect(nightSteps(seats, suggestDeck(5, false), newTracker(), null).map((s) => s.id)).toEqual(["salvateur", "loups", "sorciere"]);
  });

  it("follows the meneur's order, and slots in any step they never placed", () => {
    expect(orderedSteps(["sorciere", "loups"]).slice(0, 3).map((s) => s.id)).toEqual(["sorciere", "loups", "cupidon"]);
  });
});

describe("dawn", () => {
  it("kills the wolves' victim unless protected or saved", () => {
    const t = newTracker();
    expect(dawn(table(), night(t, { victim: "Lou" })).deaths).toEqual([{ seat: "Lou", cause: "loups" }]);
    expect(dawn(table(), night(t, { victim: "Lou", protected: "Lou" })).deaths).toEqual([]);
    expect(dawn(table(), night(t, { victim: "Lou", heal: true })).deaths).toEqual([]);
  });

  it("lets the ancien survive the first attack only", () => {
    const first = dawn(table(), night(newTracker(), { victim: "Zoé" }));
    expect(first.deaths).toEqual([]);
    expect(first.elderHit).toBe(true);
    expect(dawn(table(), night({ ...newTracker(), elderHit: true }, { victim: "Zoé" })).deaths).toEqual([{ seat: "Zoé", cause: "loups" }]);
  });

  it("takes the lover along, and warns that the wild child turns", () => {
    const t = { ...newTracker(), lovers: ["Lou", "Hugo"] as [string, string], model: "Lou" };
    const d = dawn(table(), night(t, { victim: "Lou", poison: "Eva" }));
    expect(d.deaths).toEqual([
      { seat: "Lou", cause: "loups" },
      { seat: "Eva", cause: "sorciere" },
      { seat: "Hugo", cause: "chagrin" },
    ]);
    expect(d.notes.join(" ")).toMatch(/l'enfant devient loup-garou/);
  });

  it("infects instead of killing", () => {
    const d = dawn(table(), night(newTracker(), { victim: "Lou", infect: true }));
    expect(d.deaths).toEqual([]);
    expect(toDay(night(newTracker(), { victim: "Lou", infect: true }), d, table()).infected).toEqual(["Lou"]);
  });
});

describe("the day", () => {
  it("the barbier dies with an innocent, not with a wolf", () => {
    expect(barberStrike(table(), newTracker(), "Eva", "Léa")).toEqual([{ seat: "Léa", cause: "barbier" }]);
    expect(barberStrike(table(), newTracker(), "Eva", "Inès")).toEqual([
      { seat: "Inès", cause: "barbier" },
      { seat: "Eva", cause: "barbier" },
    ]);
  });

  it("spares the idiot once", () => {
    expect(voteOut(table(), newTracker(), "Lou")).toEqual({ deaths: [], spared: true });
    expect(voteOut(table(), { ...newTracker(), idiotSpared: true }, "Lou").deaths).toEqual([{ seat: "Lou", cause: "vote" }]);
  });

  it("writes the deaths down in order, and turns the wild child when the model goes", () => {
    const t = { ...newTracker(), turn: 2, model: "Inès" };
    const { seats, tracker } = applyDeaths(table(), t, withCascade(table(), t, [{ seat: "Inès", cause: "vote" }]));
    expect(seats.find((s) => s.id === "Inès")).toMatchObject({ alive: false, diedTurn: 2, deathOrder: 1 });
    expect(tracker.transformed).toBe(true);
    expect(tracker.log.at(-1)?.text).toBe("Inès (Sorcière) : éliminé par le village.");
    expect(phaseLabel(2)).toBe("Jour 1");
  });
});

describe("outcome", () => {
  const kill = (seats: Seat[], ...ids: string[]) => seats.map((s) => (ids.includes(s.id) ? { ...s, alive: false } : s));

  it("village when the wolves are gone, wolves when only wolves remain", () => {
    expect(outcome(table(), newTracker())).toBeNull();
    expect(outcome(kill(table(), "Léa", "Hugo"), newTracker())).toBe("village");
    expect(outcome(kill(table(), "Inès", "Tom", "Zoé", "Noé", "Max", "Eva", "Lou"), newTracker())).toBe("loups");
  });

  it("the lovers of two sides win as the last two", () => {
    const t = { ...newTracker(), lovers: ["Léa", "Inès"] as [string, string] };
    expect(outcome(kill(table(), "Hugo", "Tom", "Zoé", "Noé", "Max", "Eva", "Lou"), t)).toBe("amoureux");
  });

  it("the infected count as wolves, and an unknown card leaves it open", () => {
    const t = { ...newTracker(), infected: ["Lou"] };
    expect(outcome(kill(table(), "Léa", "Hugo"), t)).toBeNull();
    expect(outcome([seat("A", "loup", { alive: false }), seat("B", null)], newTracker())).toBeNull();
  });

  it("never says village when no wolf was ever dealt: that's « peste noire », for the meneur", () => {
    expect(outcome([seat("A", "villageois"), seat("B", "sorciere")], newTracker())).toBeNull();
  });
});

describe("playerStats", () => {
  it("counts games, survivors, first out and turns lived, in alphabetical order", () => {
    const stats = playerStats([
      { playerId: "z", name: "Zoé", alive: true, diedTurn: null, deathOrder: null, lastTurn: 8 },
      { playerId: "z", name: "Zoé", alive: false, diedTurn: 2, deathOrder: 1, lastTurn: 6 },
      { playerId: "a", name: "Arthur", alive: false, diedTurn: 5, deathOrder: 3, lastTurn: 8 },
    ]);
    expect(stats).toEqual([
      { playerId: "a", name: "Arthur", games: 1, survived: 0, firstOut: 0, averageTurns: 5, wins: 0 },
      { playerId: "z", name: "Zoé", games: 2, survived: 1, firstOut: 1, averageTurns: 5, wins: 0 },
    ]);
  });
});

describe("the table's activity", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 21, h, m));
  const game = (start: Date, minutes: number, winner: Winner, players = 9, lastTurn = 6): PlayedGame => ({ startedAt: start, endedAt: new Date(start.getTime() + minutes * 60_000), winner, blackPlague: false, players, lastTurn });

  it("counts evenings, averages, and the share of each side", () => {
    const a = activity([game(at(19), 30, "village"), game(at(20), 40, "loups", 11, 7), game(at(21), 20, "village"), { ...game(new Date(Date.UTC(2026, 10, 28, 20)), 30, "amoureux"), blackPlague: true }]);
    expect(a).toMatchObject({ games: 4, evenings: 2, perEvening: 2, minutes: 30, players: 9.5, nights: 3.3, blackPlagues: 1 });
    expect(a.shares).toEqual([
      { winner: "village", games: 2, percent: 50 },
      { winner: "loups", games: 1, percent: 25 },
      { winner: "amoureux", games: 1, percent: 25 },
    ]);
    expect(activity([]).minutes).toBeNull();
  });

  it("knows who won: the village, the pack with its infected and turned wild child, the lovers", () => {
    const t = { ...newTracker(), infected: ["c"], lovers: ["a", "d"] as [string, string], transformed: true };
    const seat = (id: string, role: RoleId | null): Seat => ({ id, name: id, position: 0, role, alive: true, diedTurn: null, deathOrder: null });
    const [a, b, c, d, e] = [seat("a", "loup"), seat("b", "sorciere"), seat("c", "villageois"), seat("d", "enfant"), seat("e", "loupblanc")];
    expect([a, b, c, d, e].map((s) => seatWon(s, t, "loups"))).toEqual([true, false, true, true, false]);
    expect([a, b, c, d, e].map((s) => seatWon(s, t, "village"))).toEqual([false, true, false, false, false]);
    expect([a, b, c, d, e].map((s) => seatWon(s, t, "amoureux"))).toEqual([true, false, false, true, false]);
    expect(seatWon(e, t, "loupblanc")).toBe(true);
    expect(seatWon(b, t, "personne")).toBe(false);
  });
});

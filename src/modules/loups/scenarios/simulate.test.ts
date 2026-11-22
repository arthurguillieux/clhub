import { describe, expect, it } from "vitest";
import { ANTARCTICA } from "./antarctica";
import { replay, type Setup } from "./engine";
import { START_POINTS, simulatedJournal, simulatedPlayers } from "./simulate";

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("Simuler une partie", () => {
  const random = seeded(42);
  const players = simulatedPlayers(random, ["Camille", "Hugo"]);
  const setup: Setup = { players, params: ANTARCTICA.defaults, events: ANTARCTICA.events, extraFaults: [] };
  const stateAt = (start: (typeof START_POINTS)[number]["id"], seed = 7) =>
    replay(
      ANTARCTICA,
      setup,
      simulatedJournal(ANTARCTICA, setup, start, seeded(seed)).map((action, i) => ({ action, at: i })),
    );

  it("makes 20 distinct players, women and men, none from a real evening", () => {
    expect(players).toHaveLength(20);
    expect(new Set(players.map((p) => p.name)).size).toBe(20);
    expect(players.map((p) => p.name)).not.toContain("Camille");
    expect(players.map((p) => p.name)).not.toContain("Hugo");
  });

  it.each([
    ["b1-arrival", "arrival", 1, 0],
    ["b1-day3", "day", 1, 3],
    ["reboot", "loopEnd", 1, 3],
    ["b2-arrival", "arrival", 2, 0],
    ["b2-day3", "day", 2, 3],
  ] as const)("starts at %s: %s of loop %i, round %i", (start, phase, loop, round) => {
    for (const seed of [1, 7, 99, 2024]) {
      const s = stateAt(start, seed);
      expect(s).toMatchObject({ phase, loop, round });
      expect(s.patientZero).not.toBeNull();
    }
  });

  it("at day 3 of loop 1: 3 dead, 2 exiled, doors open, items carried, nobody has won yet", () => {
    const s = stateAt("b1-day3");
    expect(s.players.filter((p) => p.status === "dead")).toHaveLength(3);
    expect(s.players.filter((p) => p.status === "exiled")).toHaveLength(2);
    expect(s.doors).toMatchObject({ dortoir: true, beta: true });
    expect(Object.values(s.items).filter((i) => i.holder).length).toBeGreaterThanOrEqual(3);
  });

  it("at the arrival of loop 2: the sealed rooms are exactly the dead and exiled of loop 1", () => {
    const before = stateAt("reboot");
    const gone = Object.fromEntries(before.players.filter((p) => p.status !== "alive").map((p) => [p.room, p.name]));
    const s = stateAt("b2-arrival");
    expect(s.sealed).toEqual(gone);
    expect(s.players.every((p) => p.status === "alive")).toBe(true);
  });
});

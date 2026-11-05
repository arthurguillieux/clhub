import { describe, expect, it } from "vitest";
import { draw, forbiddenPairs, nextYearTitle, type Pair } from "./draw";

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function expectValid(ids: string[], pairs: Map<string, string>, forbidden: readonly Pair[] = []) {
  expect([...pairs.keys()].sort()).toEqual([...ids].sort());
  expect([...pairs.values()].sort()).toEqual([...ids].sort()); // each receives exactly once
  for (const [giver, recipient] of pairs) expect(giver).not.toBe(recipient);
  for (const [giver, recipient] of forbidden) expect(pairs.get(giver)).not.toBe(recipient);
}

describe("the Secret Santa draw", () => {
  it("gives everyone one person and one Santa, never themselves", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const ids = people(3 + (seed % 20));
      const r = draw(ids, [], [], seeded(seed));
      expect(r.ok).toBe(true);
      if (r.ok) expectValid(ids, r.pairs);
    }
  });

  it("respects the exclusions: Vak and Marie never draw each other, in either direction", () => {
    const ids = ["vak", "marie", "paul", "lea", "tom"];
    const forbidden = forbiddenPairs([{ fromId: "vak", toId: "marie", mutual: true }]);
    expect(forbidden).toEqual([["vak", "marie"], ["marie", "vak"]]);
    for (let seed = 1; seed <= 200; seed++) {
      const r = draw(ids, forbidden, [], seeded(seed));
      expect(r.ok).toBe(true);
      if (r.ok) expectValid(ids, r.pairs, forbidden);
    }
  });

  it("can forbid one direction only", () => {
    expect(forbiddenPairs([{ fromId: "a", toId: "b", mutual: false }])).toEqual([["a", "b"]]);
  });

  it("finds the only possible draw, however tight the rules", () => {
    // Each of the 6 may only give to the next one: a single solution out of 265.
    const ids = people(6);
    const forbidden: Pair[] = [];
    ids.forEach((a, i) => ids.forEach((b, j) => j !== (i + 1) % 6 && a !== b && forbidden.push([a, b])));
    const r = draw(ids, forbidden, [], seeded(5));
    expect(r.ok).toBe(true);
    if (r.ok) ids.forEach((a, i) => expect(r.pairs.get(a)).toBe(ids[(i + 1) % 6]));
  });

  it("says who is stuck when the rules make it impossible", () => {
    const r = draw(["a", "b", "c"], [["a", "b"], ["a", "c"]], [], seeded(1));
    expect(r).toEqual({ ok: false, noRecipient: ["a"], noGiver: [] });
    const nobody = draw(["a", "b", "c"], [["b", "a"], ["c", "a"]], [], seeded(1));
    expect(nobody).toEqual({ ok: false, noRecipient: [], noGiver: ["a"] });
  });

  it("detects a draw that's impossible overall, with nobody stuck on their own", () => {
    // a and b can only give to c, so one of them is left without a recipient.
    const r = draw(["a", "b", "c", "d"], [["a", "b"], ["a", "d"], ["b", "a"], ["b", "d"]], [], seeded(1));
    expect(r).toEqual({ ok: false, noRecipient: [], noGiver: [] });
  });

  it("doesn't repeat last year's draw when it can avoid it", () => {
    const ids = people(8);
    const lastYear: Pair[] = ids.map((id, i) => [id, ids[(i + 1) % 8]!]);
    for (let seed = 1; seed <= 100; seed++) {
      const r = draw(ids, [], lastYear, seeded(seed));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.repeats).toBe(0);
        expectValid(ids, r.pairs, lastYear);
      }
    }
  });

  it("repeats last year only when there's no other way, and as little as possible", () => {
    // With 3 people there are two draws; last year's pairs cover all of one and one pair of the other.
    const r = draw(["a", "b", "c"], [], [["a", "b"], ["b", "c"], ["c", "a"], ["a", "c"]], seeded(2));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.repeats).toBe(1);
      expect(r.pairs.get("a")).toBe("c");
    }
  });

  it("prefers draws without A↔B swaps when there are any", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = draw(people(6), [], [], seeded(seed));
      if (r.ok) expect([...r.pairs].filter(([a, b]) => r.pairs.get(b) === a)).toHaveLength(0);
    }
  });

  it("is different from one draw to the next", () => {
    const ids = people(10);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const r = draw(ids, [], [], seeded(seed));
      if (r.ok) seen.add(ids.map((id) => r.pairs.get(id)).join());
    }
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe("next year's title", () => {
  it("moves the year on, or adds it", () => {
    expect(nextYearTitle("Noël 2026", 2026)).toBe("Noël 2027");
    expect(nextYearTitle("Noël en famille", 2026)).toBe("Noël en famille 2027");
  });
});

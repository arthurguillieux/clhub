import { describe, expect, it } from "vitest";
import { MAX_DAYS, daysBetween, drinkTotals, headcount, portions, type Presence } from "./meals";

describe("daysBetween", () => {
  it("lists every day, both ends included, across a month", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("gives one day when both ends are the same", () => {
    expect(daysBetween("2026-12-24", "2026-12-24")).toEqual(["2026-12-24"]);
  });
  it("refuses a backwards or too long range, and nonsense", () => {
    expect(daysBetween("2026-12-25", "2026-12-23")).toEqual([]);
    expect(daysBetween("2026-12-01", "2026-12-31")).toEqual([]);
    expect(daysBetween("2026-12-01", `2026-12-${String(MAX_DAYS).padStart(2, "0")}`)).toHaveLength(MAX_DAYS);
    expect(daysBetween("demain", "2026-12-25")).toEqual([]);
  });
});

describe("headcount", () => {
  const people: { guests: number; presence: Record<string, Presence> }[] = [
    { guests: 1, presence: { a: "x", b: "?" } }, // Arthur, with a child
    { guests: 0, presence: { a: "x" } },
    { guests: 0, presence: {} },
  ];
  it("counts each person with their guests, apart from the maybes and the silent", () => {
    expect(headcount(people, "a")).toEqual({ sure: 3, maybe: 0, unanswered: 1 });
    expect(headcount(people, "b")).toEqual({ sure: 0, maybe: 2, unanswered: 2 });
  });
});

describe("portions", () => {
  it("adds up what feeds the table, not the apéro, the « autre » or ideas", () => {
    expect(
      portions([
        { category: "Entrée", parts: 8, idea: false },
        { category: "Plat", parts: 10, idea: false },
        { category: "Apéro", parts: 12, idea: false },
        { category: "Autre", parts: null, idea: false },
        { category: "Plat", parts: 20, idea: true },
      ]),
    ).toEqual({ parts: 18, unknown: false });
  });
  it("says when a dish didn't give its portions", () => {
    expect(portions([{ category: "Plat", parts: null, idea: false }])).toEqual({ parts: 0, unknown: true });
  });
});

describe("drinkTotals", () => {
  it("adds the same units only, in the usual order of drinks", () => {
    expect(
      drinkTotals([
        { type: "Bière", quantity: 2, unit: "bouteilles" },
        { type: "Vin rouge", quantity: 5, unit: "L" },
        { type: "Vin rouge", quantity: 2, unit: "bouteilles" },
        { type: "Vin rouge", quantity: 2, unit: "bouteilles" },
      ]),
    ).toEqual([
      { type: "Vin rouge", amounts: [{ unit: "L", quantity: 5 }, { unit: "bouteilles", quantity: 4 }] },
      { type: "Bière", amounts: [{ unit: "bouteilles", quantity: 2 }] },
    ]);
  });
});

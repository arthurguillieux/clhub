import { describe, expect, it } from "vitest";
import { budget, eventDays, headcount, itemNeed, ruleSentence, splitByWeight, type BudgetGuest } from "./plan";
import { nextNewYear, nextTitle, templateMeals } from "./template";

const DAYS = eventDays("2026-12-31", "2027-01-02");
const MEALS = templateMeals("2026-12-31", "2027-01-02");

describe("the evening's days and meals", () => {
  it("counts the first and the last day, across the new year", () => {
    expect(DAYS).toEqual(["2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(eventDays("2026-12-31", "2026-12-31")).toEqual(["2026-12-31"]);
    expect(eventDays("2027-01-02", "2026-12-31")).toEqual([]);
  });

  it("starts with the evening of the first day and ends with lunch on the last", () => {
    expect(MEALS.map((m) => `${m.day.slice(5)} ${m.label}`)).toEqual(["12-31 Soir", "01-01 Midi", "01-01 Soir", "01-02 Midi"]);
    expect(templateMeals("2026-12-31", "2026-12-31")).toEqual([{ day: "2026-12-31", label: "Soir" }]);
  });

  it("next year's title and dates", () => {
    expect(nextTitle("Nouvel an 2025", 2026)).toBe("Nouvel an 2026");
    expect(nextTitle("NYE", 2026)).toBe("NYE 2026");
    expect(nextNewYear("2026-11-27")).toEqual({ startsOn: "2026-12-31", endsOn: "2027-01-01", year: 2026 });
  });
});

describe("the headcount", () => {
  const guests = [
    { answer: "yes" as const, days: null },
    { answer: "yes" as const, days: ["2026-12-31"] },
    { answer: "maybe" as const, days: null },
    { answer: "no" as const, days: null },
  ];

  it("counts those who said yes, each for the days they're there", () => {
    expect(headcount(guests, DAYS, MEALS, null)).toMatchObject({ people: 2, personDays: 4, personMeals: 5, days: 3, meals: 4, overridden: false });
  });

  it("follows the organizers' number when they give one", () => {
    expect(headcount(guests, DAYS, MEALS, 20)).toMatchObject({ people: 20, personDays: 60, personMeals: 80, overridden: true });
  });

  it("someone there on no listed day still counts for one", () => {
    expect(headcount([{ answer: "yes", days: ["2030-01-01"] }], DAYS, MEALS, null).personDays).toBe(1);
  });
});

describe("the quantities", () => {
  const hc = headcount([], DAYS, MEALS, 18);
  const beers = { rule: "person_day" as const, ratio: 3.5, perPack: 20, packPriceCents: 1029, stock: 0, overridePacks: null };

  it("follows the headcount and rounds up to whole packs", () => {
    // 18 people × 3 days × 3.5 = 189 cans: 10 packs of 20.
    expect(itemNeed(beers, hc)).toEqual({ units: 189, toBuy: 189, computedPacks: 10, packs: 10, costCents: 10290 });
  });

  it("takes off what is already there, and never goes below zero", () => {
    expect(itemNeed({ ...beers, stock: 60 }, hc)).toMatchObject({ toBuy: 129, packs: 7 });
    expect(itemNeed({ ...beers, stock: 500 }, hc)).toMatchObject({ toBuy: 0, packs: 0, costCents: 0 });
  });

  it("an adjustment wins over the computation, which stays visible", () => {
    expect(itemNeed({ ...beers, overridePacks: 6 }, hc)).toMatchObject({ computedPacks: 10, packs: 6, costCents: 6174 });
  });

  it("each rule: fixed, per person, per meal; no price, no cost", () => {
    expect(itemNeed({ ...beers, rule: "fixed", ratio: 2, perPack: 1 }, hc).packs).toBe(2);
    expect(itemNeed({ ...beers, rule: "person", ratio: 0.17, perPack: 1 }, hc).packs).toBe(4); // champagne: 3.06 → 4 bottles
    expect(itemNeed({ ...beers, rule: "person_meal", ratio: 1, perPack: 100, packPriceCents: null }, hc)).toMatchObject({ units: 72, packs: 1, costCents: null });
  });

  it("a whole number computed with decimals stays whole", () => {
    // 6 × 3.5 is 20.999… in floating point: still one pack of 21, not two.
    expect(itemNeed({ ...beers, perPack: 21 }, headcount([], ["2026-12-31"], [], 6)).packs).toBe(1);
  });

  it("says its rule in words", () => {
    expect(ruleSentence("person_day", 3.5)).toBe("3,5 par personne et par jour");
    expect(ruleSentence("fixed", 2)).toBe("2 en tout");
  });
});

describe("the budget", () => {
  const g = (id: string, over: Partial<BudgetGuest> = {}): BudgetGuest => ({ id, answer: "yes", days: null, optionId: null, receivedCents: 0, ...over });

  it("splits to the cent, the leftover cents to the largest remainders", () => {
    expect(splitByWeight(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(splitByWeight(1000, [3, 1])).toEqual([750, 250]);
    expect(splitByWeight(0, [1, 1])).toEqual([0, 0]);
    expect(splitByWeight(100, [0, 0])).toEqual([0, 0]);
  });

  it("the place by option, the drinks by presence, the rest equally — between those who said yes", () => {
    const b = budget({
      days: DAYS,
      guests: [g("a", { optionId: "o1" }), g("b", { optionId: "o2", days: ["2026-12-31"] }), g("c", { answer: "no", optionId: "o1" })],
      options: [
        { id: "o1", priceCents: 7600 },
        { id: "o2", priceCents: 5700 },
      ],
      lines: [
        { key: "cost:lieu", label: "Le lieu", estimateCents: 15000, split: "options" },
        { key: "list:boissons", label: "Boissons", estimateCents: 8000, split: "presence" },
        { key: "cost:sono", label: "Sono", estimateCents: 3000, split: "equal" },
      ],
      expenses: [],
    });
    const a = b.accounts.find((x) => x.guestId === "a")!;
    const bb = b.accounts.find((x) => x.guestId === "b")!;
    expect(a.parts).toEqual({ "cost:lieu": 7600, "list:boissons": 6000, "cost:sono": 1500 });
    expect(bb.parts).toEqual({ "cost:lieu": 5700, "list:boissons": 2000, "cost:sono": 1500 });
    expect(b.accounts.some((x) => x.guestId === "c")).toBe(false);
    // The options bring in 133 € against a place of 150 €: 17 € missing, shown to the organizers.
    expect(b.options).toEqual({ collectedCents: 13300, costCents: 15000 });
    expect(b.totalCents).toBe(26000);
  });

  it("real expenses replace the estimate of their line, and what someone advanced comes off their part", () => {
    const b = budget({
      days: DAYS,
      guests: [g("a"), g("b", { receivedCents: 1000 }), g("c", { answer: "no" })],
      options: [],
      lines: [{ key: "list:boissons", label: "Boissons", estimateCents: 9000, split: "equal" }],
      expenses: [
        { guestId: "a", cents: 6000, lineKey: "list:boissons" },
        // Someone who doesn't come paid the deposit: the group pays them back.
        { guestId: "c", cents: 2000, lineKey: null },
      ],
    });
    expect(b.lines.map((l) => [l.key, l.amountCents, l.realCents])).toEqual([
      ["list:boissons", 6000, 6000],
      ["other", 2000, 2000],
    ]);
    const acc = Object.fromEntries(b.accounts.map((x) => [x.guestId, x]));
    expect(acc.a).toMatchObject({ dueCents: 4000, advancedCents: 6000, balanceCents: -2000 });
    expect(acc.b).toMatchObject({ dueCents: 4000, receivedCents: 1000, balanceCents: 3000 });
    expect(acc.c).toMatchObject({ dueCents: 0, advancedCents: 2000, balanceCents: -2000 });
  });

  it("without options, a line « selon l'option » is shared equally", () => {
    const b = budget({ days: DAYS, guests: [g("a"), g("b")], options: [], lines: [{ key: "cost:lieu", label: "Le lieu", estimateCents: 1500, split: "options" }], expenses: [] });
    expect(b.accounts.map((x) => x.dueCents)).toEqual([750, 750]);
    expect(b.options).toBeNull();
  });
});

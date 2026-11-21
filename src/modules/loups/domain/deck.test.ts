import { describe, expect, it } from "vitest";
import { deckEntries, deckError, deckSize, draw, suggestDeck, wolfCount } from "./deck";
import { ROLES } from "./roles";

describe("suggestDeck", () => {
  it("gives Arthur's deck at 12", () => {
    expect(suggestDeck(12, false)).toEqual({
      loup: 2,
      enfant: 1,
      vv: 1,
      cupidon: 1,
      barbier: 1,
      ancien: 1,
      salvateur: 1,
      sorciere: 1,
      idiot: 1,
      juge: 1,
      servante: 1,
    });
  });

  it("keeps the core of five, and drops servante, juge, idiot, then Cupidon below 12", () => {
    expect(suggestDeck(5, false)).toEqual({ loup: 1, barbier: 1, salvateur: 1, sorciere: 1, ancien: 1 });
    expect(suggestDeck(11, false).servante).toBeUndefined();
    expect(suggestDeck(9, false)).toMatchObject({ cupidon: 1, loup: 2 });
    expect(suggestDeck(9, false).idiot).toBeUndefined();
    expect(suggestDeck(8, false).cupidon).toBeUndefined();
  });

  it("adds villagers above 12, a third wolf at 15, the infect at 18", () => {
    expect(suggestDeck(14, false).villageois).toBe(2);
    expect(wolfCount(suggestDeck(14, false))).toBe(2);
    expect(wolfCount(suggestDeck(15, false))).toBe(3);
    expect(suggestDeck(18, false).infect).toBe(1);
    expect(suggestDeck(18, false).enfant).toBe(1);
  });

  it("always has one card per player", () => {
    for (let n = 4; n <= 30; n++) expect(deckSize(suggestDeck(n, false))).toBe(n);
  });

  it("adds one spare card per wolf for « peste noire », never a wolf", () => {
    const deck = suggestDeck(12, true);
    expect(deckSize(deck)).toBe(14);
    expect(wolfCount(deck)).toBe(2);
    expect(deck.villageois).toBe(2);
    expect(deckSize(suggestDeck(14, true))).toBe(16);
    expect(wolfCount(suggestDeck(14, true))).toBe(2); // the 15th card would be a wolf: a villager instead
  });
});

describe("draw", () => {
  it("deals one card per seat from the deck, and leaves the spare ones", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const deck = suggestDeck(12, true);
    const cards = draw(deck, 12, random);
    expect(cards).toHaveLength(12);
    for (const e of deckEntries(deck)) expect(cards.filter((c) => c === e.id).length).toBeLessThanOrEqual(e.count);
  });

  it("can leave every wolf out when there are spare cards", () => {
    const deck = { loup: 1, villageois: 2 };
    const outcomes = new Set<string>();
    for (const r of [0, 0.5, 0.99]) outcomes.add(draw(deck, 2, () => r).join(","));
    expect([...outcomes].some((o) => !o.includes("loup"))).toBe(true);
  });
});

describe("deckError and the catalogue", () => {
  it("wants a card per player and a wolf", () => {
    expect(deckError({ loup: 1, villageois: 2 }, 4)).toBe("Il manque une carte : une par joueur au moins.");
    expect(deckError({ villageois: 5 }, 5)).toBe("Il faut au moins un loup-garou dans le deck.");
    expect(deckError(suggestDeck(12, true), 12)).toBeNull();
  });

  it("has a rule for every card", () => {
    for (const r of ROLES) expect(r.rule.length).toBeGreaterThan(30);
  });
});

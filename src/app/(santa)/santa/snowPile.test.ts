import { describe, expect, it } from "vitest";
import { COLUMN, driftCaps, land, ledgeCaps, newPile, resized, type Pile } from "./snowPile";

const flat = (length: number, cap: number): Pile => ({ heights: new Float32Array(length), caps: new Float32Array(length).fill(cap) });
const total = (pile: Pile) => pile.heights.reduce((sum, h) => sum + h, 0);

describe("snow piles", () => {
  it("grows where the flake lands", () => {
    const pile = flat(40, 15);
    land(pile, 20, 1);
    expect(pile.heights[20]).toBeGreaterThan(0.5);
    expect(pile.heights[5]).toBe(0);
  });

  it("never goes over what a surface can hold, even after thousands of flakes", () => {
    const pile = { ...flat(0, 0), ...newPile(ledgeCaps(400, 15), 0.3, () => 0.5) };
    for (let n = 0; n < 20000; n++) land(pile, n % pile.heights.length, 1.5);
    pile.heights.forEach((h, i) => expect(h).toBeLessThanOrEqual(pile.caps[i]! + 1e-4));
  });

  it("slumps: flakes landing on one spot spread sideways instead of making a needle", () => {
    const pile = flat(60, 40);
    for (let n = 0; n < 400; n++) land(pile, 30, 1);
    for (let i = 1; i < 60; i++) expect(Math.abs(pile.heights[i]! - pile.heights[i - 1]!)).toBeLessThan(6);
    expect(pile.heights[20]).toBeGreaterThan(0);
  });

  it("slumping only moves the snow around: what lands is what's there", () => {
    const pile = flat(60, 40);
    land(pile, 30, 1);
    const one = total(pile);
    for (let n = 1; n < 50; n++) land(pile, 30, 1);
    expect(total(pile)).toBeCloseTo(one * 50, 0);
  });

  it("a flake at the very end of a surface doesn't break it", () => {
    const pile = flat(10, 15);
    land(pile, 0, 1);
    land(pile, 9, 1);
    expect(pile.heights.every(Number.isFinite)).toBe(true);
  });

  it("ledges hold nothing at their ends, the most in the middle", () => {
    const caps = ledgeCaps(400, 15);
    expect(caps[0]).toBe(0);
    expect(caps.at(-1)).toBeLessThan(1);
    expect(caps[Math.floor(caps.length / 2)]).toBe(15);
  });

  it("the drift stays low over the page and banks up in the corners", () => {
    const caps = driftCaps(800, 60);
    expect(caps[Math.floor(caps.length / 2)]).toBeLessThan(20);
    expect(caps[0]).toBe(60);
  });

  it("starts already snowy, under its cap", () => {
    const pile = newPile(ledgeCaps(400, 15), 0.4, Math.random);
    expect(pile.heights[50]).toBeGreaterThan(2);
    pile.heights.forEach((h, i) => expect(h).toBeLessThanOrEqual(pile.caps[i]!));
  });

  it("keeps its snow when the surface changes size, within the new caps", () => {
    const pile = newPile(ledgeCaps(800, 15), 0.6, () => 0.5);
    const smaller = resized(pile, ledgeCaps(400, 15));
    expect(smaller.heights.length).toBe(Math.ceil(400 / COLUMN) + 1);
    expect(smaller.heights[50]).toBeGreaterThan(4);
    smaller.heights.forEach((h, i) => expect(h).toBeLessThanOrEqual(smaller.caps[i]!));
  });
});

import { describe, expect, it } from "vitest";
import { sharesFor, splitEqually } from "./split";

describe("splitEqually", () => {
  it("adds up to the price exactly", () => {
    expect(splitEqually(5000, 3)).toEqual([1667, 1667, 1666]);
    expect(splitEqually(5000, 3).reduce((a, b) => a + b, 0)).toBe(5000);
    expect(splitEqually(4000, 4)).toEqual([1000, 1000, 1000, 1000]);
  });
  it("has nothing to split without people or price", () => {
    expect(splitEqually(5000, 0)).toEqual([]);
    expect(splitEqually(0, 3)).toEqual([]);
  });
});

describe("sharesFor", () => {
  it("lets the buyer keep their own part", () => {
    const s = sharesFor(3000, ["a", "b", "c"], "b");
    expect(s.map((x) => x.cents)).toEqual([1000, 1000, 1000]);
    expect(s.filter((x) => x.owesBuyer).map((x) => x.memberId)).toEqual(["a", "c"]);
  });
});

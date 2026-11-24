import { describe, expect, it } from "vitest";
import { matches } from "./search";

describe("search matching", () => {
  it("ignores accents and case", () => {
    expect(matches("eclair", "Éclair au chocolat")).toBe(true);
    expect(matches("PERCEUSE", "perceuse à percussion")).toBe(true);
  });
  it("needs every word, in any order, across fields", () => {
    expect(matches("bosch perceuse", "Perceuse", "Bosch")).toBe(true);
    expect(matches("bosch ponceuse", "Perceuse", "Bosch")).toBe(false);
  });
  it("finds nothing for an empty query", () => {
    expect(matches("  ", "Perceuse")).toBe(false);
  });
});

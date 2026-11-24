import { describe, expect, it } from "vitest";
import { centsForInput, euros, typedEuros } from "./money";

const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("money", () => {
  it("shows euros the French way", () => {
    expect(plain(euros(4250))).toBe("42,50 €");
    expect(plain(euros(0))).toBe("0,00 €");
    expect(plain(euros(125000))).toBe("1 250,00 €");
    expect(plain(euros(-667))).toBe("−6,67 €");
  });
  it("prefills amount fields with a comma", () => {
    expect(centsForInput(4250)).toBe("42,50");
  });
  it("reads amounts as people type them", () => {
    expect(typedEuros("42,50")).toBe(42.5);
    expect(typedEuros("42.5")).toBe(42.5);
    expect(typedEuros(" 1 250 € ")).toBe(1250);
    expect(typedEuros("douze")).toBeNaN();
    expect(typedEuros("")).toBe("");
  });
});

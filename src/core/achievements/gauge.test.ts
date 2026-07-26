import { describe, expect, it } from "vitest";
import { gaugePosition } from "./gauge";

describe("gaugePosition", () => {
  it("is balanced with no activity at all", () => {
    const result = gaugePosition(0, 0);
    expect(result.ratio).toBe(0);
    expect(result.label).toBe("Équilibré");
  });

  it("is balanced when lent and borrowed days are equal", () => {
    const result = gaugePosition(10, 10);
    expect(result.ratio).toBe(0);
    expect(result.label).toBe("Équilibré");
  });

  it("leans toward pure borrower with only borrowed days", () => {
    const result = gaugePosition(0, 20);
    expect(result.ratio).toBe(-1);
    expect(result.label).toBe("Emprunteur en série");
  });

  it("leans toward Mécène with overwhelming lending", () => {
    const result = gaugePosition(1000, 5);
    expect(result.ratio).toBeGreaterThan(0.6);
    expect(result.label).toBe("Mécène du club");
  });

  it("is a mild lender lean just past the balanced band", () => {
    const result = gaugePosition(20, 10); // ratio = 10/30 = 0.33
    expect(result.label).toBe("Plutôt prêteur");
  });

  it("is a mild borrower lean just past the balanced band", () => {
    const result = gaugePosition(10, 20); // ratio = -10/30 = -0.33
    expect(result.label).toBe("Plutôt emprunteur");
  });

  it("stays within the balanced band right at its edges", () => {
    // ratio exactly 0.15 and -0.15
    expect(gaugePosition(57.5, 42.5).label).toBe("Équilibré");
    expect(gaugePosition(42.5, 57.5).label).toBe("Équilibré");
  });
});

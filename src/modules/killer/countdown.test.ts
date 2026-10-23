import { describe, expect, it } from "vitest";
import { COUNTDOWN_LEAVE_S, COUNTDOWN_ZERO_S, countdownNumber } from "./countdown";

describe("launch countdown", () => {
  it("shows nothing before the first shot, then 10 at 1 s, 9 at 2 s … 0 at 11 s", () => {
    expect(countdownNumber(0)).toBeNull();
    expect(countdownNumber(0.99)).toBeNull();
    expect(countdownNumber(1)).toBe(10);
    expect(countdownNumber(1.9)).toBe(10);
    expect(countdownNumber(2)).toBe(9);
    expect(countdownNumber(10)).toBe(1);
    expect(countdownNumber(11)).toBe(0);
    expect(countdownNumber(14)).toBe(0);
  });

  it("starts the game at 11 s and leaves the TV screen soon after, while the 15 s sound plays on", () => {
    expect(COUNTDOWN_ZERO_S).toBe(11);
    expect(COUNTDOWN_LEAVE_S).toBeGreaterThan(11);
    expect(COUNTDOWN_LEAVE_S).toBeLessThan(15);
  });
});

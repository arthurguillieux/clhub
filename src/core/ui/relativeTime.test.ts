import { describe, expect, it } from "vitest";
import { formatExact, formatRelative } from "./relativeTime";

// 18 Oct 2026, 12:00 in Paris (CEST, UTC+2) — a Sunday, before DST ends on the 25th.
const NOW = new Date("2026-10-18T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe("formatRelative", () => {
  it("says « à l'instant » for the last few seconds, and for a clock slightly ahead", () => {
    expect(formatRelative(ago(10 * SECOND), NOW)).toBe("à l'instant");
    expect(formatRelative(new Date(NOW.getTime() + 5 * SECOND), NOW)).toBe("à l'instant");
  });

  it("counts minutes, never « il y a 0 min »", () => {
    expect(formatRelative(ago(50 * SECOND), NOW)).toBe("il y a 1 min");
    expect(formatRelative(ago(2 * MINUTE), NOW)).toBe("il y a 2 min");
    expect(formatRelative(ago(59 * MINUTE), NOW)).toBe("il y a 59 min");
  });

  it("counts hours up to six, then switches to a clock time", () => {
    expect(formatRelative(ago(3 * HOUR), NOW)).toBe("il y a 3 h");
    expect(formatRelative(ago(6.5 * HOUR), NOW)).toBe("aujourd'hui à 05:30");
  });

  it("reads the calendar day in Paris, not in UTC", () => {
    // 22:30 UTC on the 17th is already 00:30 on the 18th in Paris — today, not yesterday.
    expect(formatRelative(new Date("2026-10-17T22:30:00Z"), NOW)).toBe("aujourd'hui à 00:30");
    expect(formatRelative(new Date("2026-10-17T20:00:00Z"), NOW)).toBe("hier à 22:00");
  });

  it("names the weekday within the last week", () => {
    expect(formatRelative(new Date("2026-10-14T12:00:00Z"), NOW)).toBe("mercredi à 14:00");
  });

  it("falls back to a date, with the year only when it isn't this one", () => {
    expect(formatRelative(new Date("2026-10-05T10:00:00Z"), NOW)).toBe("5 oct.");
    expect(formatRelative(new Date("2025-12-24T10:00:00Z"), NOW)).toBe("24 déc. 2025");
  });
});

describe("formatExact", () => {
  it("gives the full date and the Paris hour", () => {
    expect(formatExact(NOW)).toBe("18 octobre 2026 à 12:00");
  });
});

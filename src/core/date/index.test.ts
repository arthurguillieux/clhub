import { describe, expect, it } from "vitest";
import {
  addDays,
  compare,
  diffDays,
  eachDay,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isWeekend,
  parse,
  startOfMonth,
  today,
  weekday,
} from "./index";

describe("parse", () => {
  it("accepts a valid date", () => {
    expect(parse("2026-07-26")).toBe("2026-07-26");
  });

  it("rejects malformed strings", () => {
    expect(() => parse("26/07/2026")).toThrow();
    expect(() => parse("2026-7-26")).toThrow();
    expect(() => parse("not-a-date")).toThrow();
    expect(() => parse("")).toThrow();
  });

  it("rejects calendar dates that don't exist", () => {
    expect(() => parse("2025-02-30")).toThrow(); // February never has 30 days
    expect(() => parse("2025-04-31")).toThrow(); // April has 30 days
    expect(() => parse("2025-13-01")).toThrow(); // no 13th month
    expect(() => parse("2025-00-01")).toThrow(); // no month 0
    expect(() => parse("2025-01-00")).toThrow(); // no day 0
  });

  it("accepts February 29th only on leap years", () => {
    expect(parse("2024-02-29")).toBe("2024-02-29"); // 2024 is a leap year
    expect(() => parse("2025-02-29")).toThrow(); // 2025 is not
  });

  it("handles the century leap-year rule", () => {
    expect(() => parse("1900-02-29")).toThrow(); // divisible by 100, not by 400
    expect(parse("2000-02-29")).toBe("2000-02-29"); // divisible by 400
  });
});

describe("format", () => {
  it("is the identity on an already-valid date", () => {
    const d = parse("2026-01-05");
    expect(format(d)).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("adds within a month", () => {
    expect(addDays(parse("2026-07-10"), 5)).toBe("2026-07-15");
  });

  it("subtracts with a negative count", () => {
    expect(addDays(parse("2026-07-10"), -5)).toBe("2026-07-05");
  });

  it("crosses a month boundary", () => {
    expect(addDays(parse("2026-01-30"), 3)).toBe("2026-02-02");
  });

  it("crosses a year boundary", () => {
    expect(addDays(parse("2026-12-30"), 3)).toBe("2027-01-02");
  });

  it("crosses backwards over a year boundary", () => {
    expect(addDays(parse("2026-01-02"), -3)).toBe("2025-12-30");
  });

  it("crosses a leap day forward", () => {
    expect(addDays(parse("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(parse("2024-02-28"), 2)).toBe("2024-03-01");
  });

  it("skips the leap day on a non-leap year", () => {
    expect(addDays(parse("2025-02-28"), 1)).toBe("2025-03-01");
  });

  it("adding zero is the identity", () => {
    expect(addDays(parse("2026-07-26"), 0)).toBe("2026-07-26");
  });
});

describe("diffDays", () => {
  it("is zero for the same date", () => {
    expect(diffDays(parse("2026-07-26"), parse("2026-07-26"))).toBe(0);
  });

  it("is positive when b is after a", () => {
    expect(diffDays(parse("2026-07-01"), parse("2026-07-15"))).toBe(14);
  });

  it("is negative when b is before a", () => {
    expect(diffDays(parse("2026-07-15"), parse("2026-07-01"))).toBe(-14);
  });

  it("counts across a leap day", () => {
    expect(diffDays(parse("2024-02-28"), parse("2024-03-01"))).toBe(2);
  });

  it("is the inverse of addDays", () => {
    const start = parse("2026-03-15");
    const end = addDays(start, 47);
    expect(diffDays(start, end)).toBe(47);
  });
});

describe("compare / isBefore / isAfter", () => {
  it("orders dates chronologically", () => {
    expect(compare(parse("2026-01-01"), parse("2026-01-02"))).toBe(-1);
    expect(compare(parse("2026-01-02"), parse("2026-01-01"))).toBe(1);
    expect(compare(parse("2026-01-01"), parse("2026-01-01"))).toBe(0);
  });

  it("orders correctly across year boundaries despite string length being equal", () => {
    expect(compare(parse("2025-12-31"), parse("2026-01-01"))).toBe(-1);
  });

  it("isBefore / isAfter agree with compare", () => {
    expect(isBefore(parse("2026-01-01"), parse("2026-01-02"))).toBe(true);
    expect(isAfter(parse("2026-01-02"), parse("2026-01-01"))).toBe(true);
    expect(isBefore(parse("2026-01-01"), parse("2026-01-01"))).toBe(false);
  });
});

describe("eachDay", () => {
  it("includes both endpoints", () => {
    expect(eachDay(parse("2026-07-01"), parse("2026-07-03"))).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });

  it("returns a single-element array when start equals end", () => {
    expect(eachDay(parse("2026-07-01"), parse("2026-07-01"))).toEqual(["2026-07-01"]);
  });

  it("throws when start is after end", () => {
    expect(() => eachDay(parse("2026-07-03"), parse("2026-07-01"))).toThrow();
  });

  it("spans a leap day correctly", () => {
    expect(eachDay(parse("2024-02-27"), parse("2024-03-01"))).toEqual([
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("finds the boundaries of a 31-day month", () => {
    expect(startOfMonth(parse("2026-07-15"))).toBe("2026-07-01");
    expect(endOfMonth(parse("2026-07-15"))).toBe("2026-07-31");
  });

  it("finds the boundaries of February on a leap year", () => {
    expect(endOfMonth(parse("2024-02-10"))).toBe("2024-02-29");
  });

  it("finds the boundaries of February on a non-leap year", () => {
    expect(endOfMonth(parse("2025-02-10"))).toBe("2025-02-28");
  });

  it("handles December rolling into the next year", () => {
    expect(endOfMonth(parse("2026-12-05"))).toBe("2026-12-31");
  });

  it("is idempotent on the boundary dates themselves", () => {
    expect(startOfMonth(parse("2026-07-01"))).toBe("2026-07-01");
    expect(endOfMonth(parse("2026-07-31"))).toBe("2026-07-31");
  });
});

describe("weekday / isWeekend", () => {
  it("identifies a known Monday as ISO weekday 1", () => {
    // 2026-07-27 is a Monday.
    expect(weekday(parse("2026-07-27"))).toBe(1);
  });

  it("identifies a known Sunday as ISO weekday 7", () => {
    expect(weekday(parse("2026-07-26"))).toBe(7);
  });

  it("flags Saturday and Sunday as the weekend", () => {
    expect(isWeekend(parse("2026-07-25"))).toBe(true); // Saturday
    expect(isWeekend(parse("2026-07-26"))).toBe(true); // Sunday
    expect(isWeekend(parse("2026-07-27"))).toBe(false); // Monday
  });
});

describe("today", () => {
  it("returns a valid, parseable CalendarDate", () => {
    const d = today("Europe/Paris");
    expect(() => parse(d)).not.toThrow();
  });

  it("defaults to Europe/Paris", () => {
    expect(today()).toBe(today("Europe/Paris"));
  });
});

import { describe, expect, it } from "vitest";
import { parse } from "@/core/date";
import {
  applyBuffer,
  busyRanges,
  canBook,
  combinedBusyRanges,
  findAvailableUnitIndex,
  freeSlots,
  mergeRanges,
  overlaps,
  suggestAlternatives,
  type Range,
} from "./availability";

function r(start: string, end: string): Range {
  return { start: parse(start), end: parse(end) };
}

describe("overlaps", () => {
  it("detects a clear overlap", () => {
    expect(overlaps(r("2026-07-10", "2026-07-15"), r("2026-07-12", "2026-07-20"))).toBe(true);
  });

  it("detects no overlap when ranges are far apart", () => {
    expect(overlaps(r("2026-07-01", "2026-07-05"), r("2026-08-01", "2026-08-05"))).toBe(false);
  });

  it("treats inclusive bounds correctly: sharing exactly one day counts as overlap", () => {
    expect(overlaps(r("2026-07-01", "2026-07-10"), r("2026-07-10", "2026-07-20"))).toBe(true);
  });

  it("does not overlap when one ends the day before the other starts", () => {
    expect(overlaps(r("2026-07-01", "2026-07-10"), r("2026-07-11", "2026-07-20"))).toBe(false);
  });

  it("is symmetric", () => {
    const a = r("2026-07-01", "2026-07-10");
    const b = r("2026-07-05", "2026-07-08");
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });

  it("a range overlaps itself", () => {
    const a = r("2026-07-01", "2026-07-01");
    expect(overlaps(a, a)).toBe(true);
  });
});

describe("mergeRanges", () => {
  it("returns an empty array for no input", () => {
    expect(mergeRanges([])).toEqual([]);
  });

  it("leaves non-overlapping, non-adjacent ranges separate", () => {
    const result = mergeRanges([r("2026-07-01", "2026-07-05"), r("2026-07-10", "2026-07-15")]);
    expect(result).toEqual([r("2026-07-01", "2026-07-05"), r("2026-07-10", "2026-07-15")]);
  });

  it("merges overlapping ranges", () => {
    const result = mergeRanges([r("2026-07-01", "2026-07-10"), r("2026-07-05", "2026-07-15")]);
    expect(result).toEqual([r("2026-07-01", "2026-07-15")]);
  });

  it("merges adjacent ranges with no gap between them", () => {
    const result = mergeRanges([r("2026-07-01", "2026-07-05"), r("2026-07-06", "2026-07-10")]);
    expect(result).toEqual([r("2026-07-01", "2026-07-10")]);
  });

  it("keeps ranges separate when exactly one day apart", () => {
    // 07-05 end, then a free 07-06, then 07-07 start — a real gap, not adjacent.
    const result = mergeRanges([r("2026-07-01", "2026-07-05"), r("2026-07-07", "2026-07-10")]);
    expect(result).toEqual([r("2026-07-01", "2026-07-05"), r("2026-07-07", "2026-07-10")]);
  });

  it("merges three ranges chained together out of order", () => {
    const result = mergeRanges([
      r("2026-07-20", "2026-07-25"),
      r("2026-07-01", "2026-07-05"),
      r("2026-07-06", "2026-07-19"),
    ]);
    expect(result).toEqual([r("2026-07-01", "2026-07-25")]);
  });

  it("a single-day range merges correctly with an adjacent single day", () => {
    const result = mergeRanges([r("2026-07-01", "2026-07-01"), r("2026-07-02", "2026-07-02")]);
    expect(result).toEqual([r("2026-07-01", "2026-07-02")]);
  });
});

describe("applyBuffer", () => {
  it("expands both ends by the given number of days", () => {
    expect(applyBuffer(r("2026-07-10", "2026-07-15"), 2)).toEqual(r("2026-07-08", "2026-07-17"));
  });

  it("is a no-op for zero buffer", () => {
    const range = r("2026-07-10", "2026-07-15");
    expect(applyBuffer(range, 0)).toEqual(range);
  });

  it("is a no-op for negative buffer (defensive)", () => {
    const range = r("2026-07-10", "2026-07-15");
    expect(applyBuffer(range, -3)).toEqual(range);
  });
});

describe("busyRanges", () => {
  it("excludes pending bookings — a pending request never blocks (ADR-006)", () => {
    const result = busyRanges([{ range: r("2026-07-10", "2026-07-15"), status: "pending" }]);
    expect(result).toEqual([]);
  });

  it("includes approved and active bookings", () => {
    const result = busyRanges([
      { range: r("2026-07-01", "2026-07-05"), status: "approved" },
      { range: r("2026-07-10", "2026-07-12"), status: "active" },
    ]);
    expect(result).toEqual([r("2026-07-01", "2026-07-05"), r("2026-07-10", "2026-07-12")]);
  });

  it("excludes rejected, cancelled, and returned bookings", () => {
    const result = busyRanges([
      { range: r("2026-07-01", "2026-07-05"), status: "rejected" },
      { range: r("2026-07-10", "2026-07-12"), status: "cancelled" },
      { range: r("2026-07-20", "2026-07-22"), status: "returned" },
    ]);
    expect(result).toEqual([]);
  });

  it("applies the buffer before merging", () => {
    const result = busyRanges(
      [
        { range: r("2026-07-01", "2026-07-05"), status: "approved" },
        { range: r("2026-07-08", "2026-07-10"), status: "approved" },
      ],
      2,
    );
    // 07-01..07-05 buffered -> 06-29..07-07; 07-08..07-10 buffered -> 07-06..07-12
    // these now touch/overlap and must merge into one range.
    expect(result).toEqual([r("2026-06-29", "2026-07-12")]);
  });
});

describe("canBook", () => {
  const rules = { maxLoanDays: null, bufferDays: 0 };

  it("allows a request with no conflicts", () => {
    expect(canBook(r("2026-07-01", "2026-07-05"), [], rules)).toEqual({ ok: true });
  });

  it("rejects an inverted range", () => {
    expect(canBook(r("2026-07-05", "2026-07-01"), [], rules)).toEqual({
      ok: false,
      reason: "invalid-range",
    });
  });

  it("rejects on a one-day overlap with an existing busy range", () => {
    const busy = [r("2026-07-01", "2026-07-10")];
    const result = canBook(r("2026-07-10", "2026-07-15"), busy, rules);
    expect(result).toEqual({
      ok: false,
      reason: "overlap",
      conflictingRange: r("2026-07-01", "2026-07-10"),
    });
  });

  it("allows a request that starts the day after an existing busy range ends", () => {
    const busy = [r("2026-07-01", "2026-07-10")];
    expect(canBook(r("2026-07-11", "2026-07-15"), busy, rules)).toEqual({ ok: true });
  });

  it("rejects when the item is entirely unavailable across the whole window", () => {
    const busy = [r("2026-01-01", "2026-12-31")];
    const result = canBook(r("2026-07-10", "2026-07-15"), busy, rules);
    expect(result.ok).toBe(false);
  });

  it("enforces a maximum loan duration", () => {
    const result = canBook(r("2026-07-01", "2026-07-10"), [], { maxLoanDays: 5, bufferDays: 0 });
    expect(result).toEqual({
      ok: false,
      reason: "too-long",
      requestedDays: 10,
      maxDays: 5,
    });
  });

  it("allows a request exactly at the maximum duration", () => {
    const result = canBook(r("2026-07-01", "2026-07-05"), [], { maxLoanDays: 5, bufferDays: 0 });
    expect(result).toEqual({ ok: true });
  });

  it("a single-day request is valid and counts as one day", () => {
    const result = canBook(r("2026-07-01", "2026-07-01"), [], { maxLoanDays: 1, bufferDays: 0 });
    expect(result).toEqual({ ok: true });
  });
});

describe("freeSlots", () => {
  const window = r("2026-07-01", "2026-07-31");

  it("returns the whole window when nothing is busy", () => {
    expect(freeSlots([], window)).toEqual([window]);
  });

  it("splits the window around a single busy range", () => {
    const busy = [r("2026-07-10", "2026-07-15")];
    expect(freeSlots(busy, window)).toEqual([
      r("2026-07-01", "2026-07-09"),
      r("2026-07-16", "2026-07-31"),
    ]);
  });

  it("excludes slots shorter than the minimum requested duration", () => {
    // free gap between busy ranges is exactly 07-06..07-06 (1 day)
    const busy = [r("2026-07-01", "2026-07-05"), r("2026-07-07", "2026-07-31")];
    expect(freeSlots(busy, window, 2)).toEqual([]);
    expect(freeSlots(busy, window, 1)).toEqual([r("2026-07-06", "2026-07-06")]);
  });

  it("handles a busy range extending past the window's edges", () => {
    const busy = [r("2026-06-25", "2026-07-05")];
    expect(freeSlots(busy, window)).toEqual([r("2026-07-06", "2026-07-31")]);
  });

  it("returns nothing when the item is busy for the entire window", () => {
    const busy = [r("2026-01-01", "2026-12-31")];
    expect(freeSlots(busy, window)).toEqual([]);
  });
});

describe("suggestAlternatives", () => {
  const window = r("2026-07-01", "2026-07-31");

  it("suggests the very next available slot of the same duration", () => {
    const busy = [r("2026-07-10", "2026-07-14")];
    const request = r("2026-07-10", "2026-07-12"); // 3 days, conflicts
    const suggestions = suggestAlternatives(busy, request, window, 1);
    expect(suggestions).toEqual([r("2026-07-15", "2026-07-17")]);
  });

  it("returns nothing when no slot of sufficient length exists", () => {
    const busy = [r("2026-07-01", "2026-07-31")];
    const suggestions = suggestAlternatives(busy, r("2026-07-01", "2026-07-03"), window, 3);
    expect(suggestions).toEqual([]);
  });

  it("caps results at the requested limit", () => {
    const suggestions = suggestAlternatives([], r("2026-07-01", "2026-07-01"), window, 2);
    expect(suggestions).toHaveLength(2);
  });
});

describe("combinedBusyRanges", () => {
  it("returns nothing for zero units", () => {
    expect(combinedBusyRanges([])).toEqual([]);
  });

  it("a single unit passes its own busy ranges through unchanged", () => {
    const unit = [r("2026-07-10", "2026-07-15")];
    expect(combinedBusyRanges([unit])).toEqual(unit);
  });

  it("two units busy on the exact same days are fully busy at the item level", () => {
    const unitA = [r("2026-07-10", "2026-07-15")];
    const unitB = [r("2026-07-10", "2026-07-15")];
    expect(combinedBusyRanges([unitA, unitB])).toEqual([r("2026-07-10", "2026-07-15")]);
  });

  it("two units busy on different days are never fully busy", () => {
    const unitA = [r("2026-07-01", "2026-07-05")];
    const unitB = [r("2026-07-10", "2026-07-15")];
    expect(combinedBusyRanges([unitA, unitB])).toEqual([]);
  });

  it("only the overlapping slice of two staggered busy ranges is fully busy", () => {
    const unitA = [r("2026-07-01", "2026-07-10")]; // free from day 11
    const unitB = [r("2026-07-05", "2026-07-15")]; // busy from day 5
    // Both busy only 07-05..07-10 — that's the only stretch with zero free units.
    expect(combinedBusyRanges([unitA, unitB])).toEqual([r("2026-07-05", "2026-07-10")]);
  });

  it("one always-free unit means the item is never fully busy", () => {
    const unitA = [r("2026-07-01", "2026-07-31")];
    const unitB: Range[] = [];
    expect(combinedBusyRanges([unitA, unitB])).toEqual([]);
  });

  it("three units require all three busy at once to count", () => {
    const unitA = [r("2026-07-01", "2026-07-31")];
    const unitB = [r("2026-07-01", "2026-07-31")];
    const unitC = [r("2026-07-15", "2026-07-20")]; // only this window has all three busy
    expect(combinedBusyRanges([unitA, unitB, unitC])).toEqual([r("2026-07-15", "2026-07-20")]);
  });
});

describe("findAvailableUnitIndex", () => {
  const request = r("2026-07-10", "2026-07-15");

  it("returns -1 when there are no units", () => {
    expect(findAvailableUnitIndex([], request)).toBe(-1);
  });

  it("picks the first free unit, in order", () => {
    const busyUnit = [r("2026-07-10", "2026-07-15")];
    const freeUnit: Range[] = [];
    expect(findAvailableUnitIndex([busyUnit, freeUnit], request)).toBe(1);
    expect(findAvailableUnitIndex([freeUnit, busyUnit], request)).toBe(0);
  });

  it("returns -1 when every unit conflicts", () => {
    const busyUnit = [r("2026-07-10", "2026-07-15")];
    expect(findAvailableUnitIndex([busyUnit, busyUnit], request)).toBe(-1);
  });
});

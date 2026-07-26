import { describe, expect, it } from "vitest";
import { parse } from "@/core/date";
import { buildMonthGrid, packLanes, sliceByWeek, type PlaceableSegment, type Range } from "./layout";

function r(start: string, end: string): Range {
  return { start: parse(start), end: parse(end) };
}

describe("buildMonthGrid", () => {
  it("always returns 6 weeks of 7 days — 42 days total", () => {
    const weeks = buildMonthGrid(parse("2026-07-15"));
    expect(weeks).toHaveLength(6);
    for (const week of weeks) {
      expect(week.days).toHaveLength(7);
    }
  });

  it("starts the grid exactly on the 1st when it's already a Monday", () => {
    // 2026-06-01 is a Monday.
    const weeks = buildMonthGrid(parse("2026-06-15"));
    expect(weeks[0]?.days[0]).toBe("2026-06-01");
  });

  it("pads with the previous month when the 1st isn't a Monday", () => {
    // 2026-07-01 is a Wednesday — grid should start on the Monday before it.
    const weeks = buildMonthGrid(parse("2026-07-15"));
    expect(weeks[0]?.days[0]).toBe("2026-06-29");
    expect(weeks[0]?.days[2]).toBe("2026-07-01");
  });

  it("covers every day of a short month (February, non-leap)", () => {
    const weeks = buildMonthGrid(parse("2025-02-10"));
    const allDays = weeks.flatMap((w) => w.days);
    expect(allDays).toContain("2025-02-01");
    expect(allDays).toContain("2025-02-28");
  });

  it("covers every day of a long month (31 days) even when it needs all 6 rows", () => {
    // 2026-08-01 is a Saturday: with a Monday-start grid, August 2026 spans into a 6th row.
    const weeks = buildMonthGrid(parse("2026-08-15"));
    const allDays = weeks.flatMap((w) => w.days);
    expect(allDays).toContain("2026-08-01");
    expect(allDays).toContain("2026-08-31");
  });

  it("respects a Sunday-start week when asked", () => {
    // 2026-07-01 is a Wednesday; the Sunday on/before it is 2026-06-28.
    const weeks = buildMonthGrid(parse("2026-07-15"), 7);
    expect(weeks[0]?.days[0]).toBe("2026-06-28");
  });

  it("is anchored to the month, not the specific day passed in", () => {
    const first = buildMonthGrid(parse("2026-07-01"));
    const last = buildMonthGrid(parse("2026-07-31"));
    expect(first).toEqual(last);
  });
});

describe("sliceByWeek", () => {
  const weeks = buildMonthGrid(parse("2026-07-15")); // grid starts 2026-06-29 (Mon)

  it("produces a single segment for a range within one week, both endpoints real", () => {
    // 2026-07-01 (Wed) to 2026-07-03 (Fri) — same week as the grid's second row.
    const segments = sliceByWeek(r("2026-07-01", "2026-07-03"), weeks);
    expect(segments).toEqual([
      { weekIndex: 0, startCol: 2, span: 3, isRangeStart: true, isRangeEnd: true },
    ]);
  });

  it("produces one segment per week for a range spanning two weeks, with flat continuation edges", () => {
    // Week 0 ends 2026-07-05 (Sun); week 1 starts 2026-07-06 (Mon).
    const segments = sliceByWeek(r("2026-07-03", "2026-07-08"), weeks);
    expect(segments).toEqual([
      { weekIndex: 0, startCol: 4, span: 3, isRangeStart: true, isRangeEnd: false },
      { weekIndex: 1, startCol: 0, span: 3, isRangeStart: false, isRangeEnd: true },
    ]);
  });

  it("fills a full middle week (span 7, no real endpoint) for a range spanning three-plus weeks", () => {
    const segments = sliceByWeek(r("2026-07-03", "2026-07-15"), weeks);
    expect(segments).toHaveLength(3);
    expect(segments[1]).toEqual({
      weekIndex: 1,
      startCol: 0,
      span: 7,
      isRangeStart: false,
      isRangeEnd: false,
    });
  });

  it("returns a span-1 segment with both endpoints real for a single-day range", () => {
    const segments = sliceByWeek(r("2026-07-01", "2026-07-01"), weeks);
    expect(segments).toEqual([
      { weekIndex: 0, startCol: 2, span: 1, isRangeStart: true, isRangeEnd: true },
    ]);
  });

  it("returns nothing for a range entirely outside the grid", () => {
    const segments = sliceByWeek(r("2020-01-01", "2020-01-05"), weeks);
    expect(segments).toEqual([]);
  });

  it("clips a range that starts before the grid and ends inside it", () => {
    const segments = sliceByWeek(r("2026-06-01", "2026-07-01"), weeks);
    expect(segments[0]).toMatchObject({ weekIndex: 0, startCol: 0, isRangeStart: false });
  });
});

describe("packLanes", () => {
  function seg(id: string, startCol: number, span: number): PlaceableSegment {
    return { id, startCol, span, weekIndex: 0, isRangeStart: true, isRangeEnd: true };
  }

  it("puts non-overlapping segments all in lane 0", () => {
    const placed = packLanes([seg("a", 0, 2), seg("b", 3, 2), seg("c", 5, 2)]);
    expect(placed.map((p) => p.lane)).toEqual([0, 0, 0]);
  });

  it("puts two overlapping segments in separate lanes", () => {
    const placed = packLanes([seg("a", 0, 4), seg("b", 2, 3)]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p.lane]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(1);
  });

  it("reuses a freed lane once its previous occupant has ended", () => {
    // a: cols 0-1, b: cols 1-3 (shares col 1 with a, needs its own lane),
    // c: cols 2-3 (starts after a ends, reuses a's lane)
    const placed = packLanes([seg("a", 0, 2), seg("b", 1, 3), seg("c", 2, 2)]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p.lane]));
    expect(byId.a).toBe(0);
    expect(byId.b).toBe(1);
    expect(byId.c).toBe(0);
  });

  it("gives priority to the earlier-starting segment regardless of input order", () => {
    const placed = packLanes([seg("late", 4, 2), seg("early", 0, 2)]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p.lane]));
    expect(byId.early).toBe(0);
    expect(byId.late).toBe(0); // they don't overlap, both fit lane 0
  });

  it("on a tied start column, places the longer segment first", () => {
    const placed = packLanes([seg("short", 0, 1), seg("long", 0, 5)]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p.lane]));
    expect(byId.long).toBe(0);
    expect(byId.short).toBe(1);
  });

  it("handles three mutually overlapping segments needing three lanes", () => {
    const placed = packLanes([seg("a", 0, 5), seg("b", 1, 5), seg("c", 2, 5)]);
    const lanes = new Set(placed.map((p) => p.lane));
    expect(lanes.size).toBe(3);
  });
});

describe("buildMonthGrid + sliceByWeek + packLanes together", () => {
  it("stacks an overlapping pending request above an approved multi-week booking", () => {
    const weeks = buildMonthGrid(parse("2026-07-15"));

    const approved = sliceByWeek(r("2026-07-03", "2026-07-08"), weeks).map((s) => ({
      ...s,
      id: "approved",
    }));
    const pending = sliceByWeek(r("2026-07-05", "2026-07-06"), weeks).map((s) => ({
      ...s,
      id: "pending",
    }));

    // Both segments in week 0 overlap and need separate lanes.
    const week0 = packLanes([...approved, ...pending].filter((s) => s.weekIndex === 0));
    const byId = Object.fromEntries(week0.map((p) => [p.id, p.lane]));
    expect(byId.approved).not.toBe(byId.pending);
  });
});

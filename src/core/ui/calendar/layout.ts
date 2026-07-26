/**
 * Pure geometry for the month calendar — no React, no CSS, no DOM. A
 * component reads this output and renders `grid-column`/`grid-row`; nothing
 * here knows it's being drawn at all. See docs/02-architecture.md §4.
 */
import { addDays, compare, diffDays, eachDay, startOfMonth, weekday, type CalendarDate } from "@/core/date";

export interface Range {
  start: CalendarDate;
  end: CalendarDate;
}

export interface Week {
  /** Monday (or whatever `weekStartsOn` is) of this row. */
  start: CalendarDate;
  days: CalendarDate[];
}

export interface Segment {
  weekIndex: number;
  /** 0-based column within the week (0 = first day of the row). */
  startCol: number;
  span: number;
  /** False when this segment is a mid-range continuation into/out of this week. */
  isRangeStart: boolean;
  isRangeEnd: boolean;
}

export interface PlaceableSegment extends Segment {
  id: string;
}

export interface PlacedSegment extends PlaceableSegment {
  lane: number;
}

/**
 * Always 6 rows regardless of the month: a fixed grid height keeps the UI
 * from jumping between 4, 5, and 6-week months.
 */
export function buildMonthGrid(monthAnchor: CalendarDate, weekStartsOn = 1): Week[] {
  const firstOfMonth = startOfMonth(monthAnchor);
  const firstWeekday = weekday(firstOfMonth); // ISO: 1 = Monday .. 7 = Sunday
  const offset = (firstWeekday - weekStartsOn + 7) % 7;
  const gridStart = addDays(firstOfMonth, -offset);

  const weeks: Week[] = [];
  for (let w = 0; w < 6; w++) {
    const start = addDays(gridStart, w * 7);
    weeks.push({ start, days: eachDay(start, addDays(start, 6)) });
  }
  return weeks;
}

function weekRange(week: Week): Range {
  const start = week.days[0];
  const end = week.days[6];
  if (!start || !end) {
    throw new Error("A calendar week must have exactly 7 days");
  }
  return { start, end };
}

function overlapsRange(a: Range, b: Range): boolean {
  return compare(a.start, b.end) <= 0 && compare(b.start, a.end) <= 0;
}

/**
 * Splits a booking range into one segment per week it touches, clipped to
 * that week's boundaries. `isRangeStart`/`isRangeEnd` tell the renderer
 * which corners are real endpoints (rounded) versus a continuation into the
 * next or previous row (flat) — the detail that makes a three-week booking
 * read as one continuous ribbon instead of three disconnected blocks.
 */
export function sliceByWeek(range: Range, weeks: Week[]): Segment[] {
  const segments: Segment[] = [];

  weeks.forEach((week, weekIndex) => {
    const { start: weekStart, end: weekEnd } = weekRange(week);
    if (!overlapsRange(range, { start: weekStart, end: weekEnd })) return;

    const clippedStart = compare(range.start, weekStart) > 0 ? range.start : weekStart;
    const clippedEnd = compare(range.end, weekEnd) < 0 ? range.end : weekEnd;

    segments.push({
      weekIndex,
      startCol: diffDays(weekStart, clippedStart),
      span: diffDays(clippedStart, clippedEnd) + 1,
      isRangeStart: compare(clippedStart, range.start) === 0,
      isRangeEnd: compare(clippedEnd, range.end) === 0,
    });
  });

  return segments;
}

/**
 * Clips a range to a single window (no week-splitting) — the planning view's
 * rows = items, columns = days grid needs exactly one segment per booking
 * per row, not one per week like the month view.
 */
export function clipToRange(range: Range, window: Range): Segment | null {
  if (!overlapsRange(range, window)) return null;

  const clippedStart = compare(range.start, window.start) > 0 ? range.start : window.start;
  const clippedEnd = compare(range.end, window.end) < 0 ? range.end : window.end;

  return {
    weekIndex: 0,
    startCol: diffDays(window.start, clippedStart),
    span: diffDays(clippedStart, clippedEnd) + 1,
    isRangeStart: compare(clippedStart, range.start) === 0,
    isRangeEnd: compare(clippedEnd, range.end) === 0,
  };
}

/**
 * Greedy first-fit lane assignment within a single week: segments starting
 * earlier (then longer, on ties) claim lanes first, and each segment takes
 * the first lane whose previous occupant has already ended. This is the same
 * algorithm Google Calendar's month view uses for stacking multi-day events.
 */
export function packLanes<T extends PlaceableSegment>(segments: T[]): (T & { lane: number })[] {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol || b.span - a.span);
  const laneLastCol: number[] = [];
  const placed: (T & { lane: number })[] = [];

  for (const segment of sorted) {
    const endCol = segment.startCol + segment.span - 1;
    let lane = laneLastCol.findIndex((lastCol) => lastCol < segment.startCol);
    if (lane === -1) {
      lane = laneLastCol.length;
      laneLastCol.push(endCol);
    } else {
      laneLastCol[lane] = endCol;
    }
    placed.push({ ...segment, lane });
  }

  return placed;
}

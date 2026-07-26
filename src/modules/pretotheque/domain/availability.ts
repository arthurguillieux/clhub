/**
 * Pure availability logic — no DB, no React, no Next. Everything here is a
 * function of plain data, which is what makes it exhaustively testable.
 *
 * Ranges are inclusive on both ends, expressed in `CalendarDate` (see
 * core/date): "the 12th to the 14th" is three days, and `start === end` is a
 * valid one-day range. This mirrors the Postgres exclusion constraint, which
 * also uses an inclusive `daterange(start, end, '[]')`.
 */
import { addDays, compare, diffDays, type CalendarDate } from "@/core/date";

export interface Range {
  start: CalendarDate;
  end: CalendarDate;
}

export type BookingCheck =
  | { ok: true }
  | { ok: false; reason: "invalid-range" }
  | { ok: false; reason: "overlap"; conflictingRange: Range }
  | { ok: false; reason: "too-long"; requestedDays: number; maxDays: number };

export interface BookingRules {
  /** null = no cap. */
  maxLoanDays: number | null;
  /** Days blocked on either side of an existing booking (pickup/cleaning). */
  bufferDays: number;
}

function isValidRange(range: Range): boolean {
  return compare(range.start, range.end) <= 0;
}

/** Inclusive ranges overlap when one starts on or before the other ends, both ways. */
export function overlaps(a: Range, b: Range): boolean {
  return compare(a.start, b.end) <= 0 && compare(b.start, a.end) <= 0;
}

/** True for ranges that touch with no gap — the day after `a` ends is when `b` begins. */
function isAdjacent(a: Range, b: Range): boolean {
  return compare(addDays(a.end, 1), b.start) === 0 || compare(addDays(b.end, 1), a.start) === 0;
}

/**
 * Merges overlapping and touching ranges into the minimal equivalent set,
 * sorted by start date. Two bookings back-to-back with no gap leave no free
 * day between them, so they collapse into one range just like a true overlap.
 */
export function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => compare(a.start, b.start));
  const merged: Range[] = [sorted[0] as Range];

  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1] as Range;
    if (overlaps(last, range) || isAdjacent(last, range)) {
      if (compare(range.end, last.end) > 0) {
        last.end = range.end;
      }
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/** Expands a range by `days` on each side — the pickup/cleaning buffer around a real booking. */
export function applyBuffer(range: Range, days: number): Range {
  if (days <= 0) return range;
  return { start: addDays(range.start, -days), end: addDays(range.end, days) };
}

/**
 * The ranges that actually block a new booking. Per ADR-006, pending
 * requests never block — only confirmed or in-progress loans do, mirroring
 * the database's exclusion constraint (`WHERE status IN ('approved', 'active')`).
 */
export function busyRanges(
  bookings: { range: Range; status: string }[],
  bufferDays = 0,
): Range[] {
  const blocking = bookings
    .filter((b) => b.status === "approved" || b.status === "active")
    .map((b) => applyBuffer(b.range, bufferDays));
  return mergeRanges(blocking);
}

/** Free ranges within `window`, at least `minDays` long, given already-merged busy ranges. */
export function freeSlots(busy: Range[], window: Range, minDays = 1): Range[] {
  const relevant = mergeRanges(busy.filter((b) => overlaps(b, window)));
  const free: Range[] = [];

  let cursor = window.start;
  for (const busyRange of relevant) {
    if (compare(cursor, busyRange.start) < 0) {
      const gapEnd = addDays(busyRange.start, -1);
      if (diffDays(cursor, gapEnd) + 1 >= minDays) {
        free.push({ start: cursor, end: gapEnd });
      }
    }
    if (compare(busyRange.end, cursor) >= 0) {
      cursor = addDays(busyRange.end, 1);
    }
  }
  if (compare(cursor, window.end) <= 0 && diffDays(cursor, window.end) + 1 >= minDays) {
    free.push({ start: cursor, end: window.end });
  }

  return free;
}

/** Validates a booking request against existing (already-buffered) busy ranges and the item's rules. */
export function canBook(request: Range, busy: Range[], rules: BookingRules): BookingCheck {
  if (!isValidRange(request)) {
    return { ok: false, reason: "invalid-range" };
  }

  const requestedDays = diffDays(request.start, request.end) + 1;
  if (rules.maxLoanDays !== null && requestedDays > rules.maxLoanDays) {
    return { ok: false, reason: "too-long", requestedDays, maxDays: rules.maxLoanDays };
  }

  const conflict = mergeRanges(busy).find((b) => overlaps(b, request));
  if (conflict) {
    return { ok: false, reason: "overlap", conflictingRange: conflict };
  }

  return { ok: true };
}

/**
 * Up to `limit` free ranges near the requested one, same duration, within
 * `window` — "libre du 15 au 18" instead of a bare rejection.
 */
export function suggestAlternatives(
  busy: Range[],
  request: Range,
  window: Range,
  limit = 3,
): Range[] {
  const duration = diffDays(request.start, request.end) + 1;
  const slots = freeSlots(busy, window, duration);

  const candidates: Range[] = [];
  for (const slot of slots) {
    const slotDays = diffDays(slot.start, slot.end) + 1;
    let cursor = slot.start;
    for (let offset = 0; offset + duration <= slotDays; offset++) {
      candidates.push({ start: cursor, end: addDays(cursor, duration - 1) });
      cursor = addDays(cursor, 1);
      if (candidates.length >= limit * 4) break; // cap the search, not just the result
    }
  }

  candidates.sort((a, b) => {
    const da = Math.abs(diffDays(request.start, a.start));
    const db = Math.abs(diffDays(request.start, b.start));
    return da - db;
  });

  return candidates.slice(0, limit);
}

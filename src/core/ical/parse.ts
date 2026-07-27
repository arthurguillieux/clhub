/**
 * Read-only RFC 5545 parsing, just enough to answer "which days is this
 * calendar busy on" — never event titles, descriptions, or locations,
 * which this parser doesn't even extract. That's the whole privacy
 * guarantee behind "L'agenda en commun" (docs/03-roadmap.md): members
 * connect a personal calendar and only ever see busy/free, never content.
 */
import { RRule, RRuleSet } from "rrule";
import { addDays, compare, fromTimestamp, type CalendarDate } from "@/core/date";

/** Unfolds RFC 5545 continuation lines (a line starting with a space or tab extends the previous one). */
function unfoldLines(raw: string): string[] {
  const rawLines = raw.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Property | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: (name ?? "").toUpperCase(), params, value };
}

/**
 * A wall-clock date/time as written in the file, plus the zone it's meant
 * to be read in — kept apart from any UTC conversion until we know whether
 * it belongs to a plain occurrence or one we're about to hand to `rrule`
 * (which wants "local time pretending to be UTC", see `toRRuleUtc` below).
 */
interface IcsDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  allDay: boolean;
  /** IANA zone name, "UTC", or null for a floating time (no TZID, no trailing Z). */
  timeZone: string | null;
}

const DEFAULT_TIME_ZONE = "Europe/Paris";

function parseIcsDateTime(prop: Property): IcsDateTime | null {
  const isDateOnly = prop.params.VALUE === "DATE" || /^\d{8}$/.test(prop.value);
  const match = isDateOnly
    ? /^(\d{4})(\d{2})(\d{2})$/.exec(prop.value)
    : /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(prop.value);
  if (!match) return null;

  if (isDateOnly) {
    const [, y, m, d] = match as unknown as [string, string, string, string];
    return {
      year: Number(y), month: Number(m), day: Number(d),
      hour: 0, minute: 0, second: 0, allDay: true, timeZone: null,
    };
  }

  const [, y, m, d, h, mi, s, z] = match as unknown as [
    string, string, string, string, string, string, string, string | undefined,
  ];
  return {
    year: Number(y), month: Number(m), day: Number(d),
    hour: Number(h), minute: Number(mi), second: Number(s),
    allDay: false,
    timeZone: z ? "UTC" : (prop.params.TZID ?? null),
  };
}

/**
 * Converts a wall-clock date/time in a given IANA zone to the true UTC
 * instant — the standard "format a guess, measure the drift, correct"
 * technique (no `Temporal` support to rely on yet). Good enough at
 * day-granularity, which is all this feature needs; exact-second accuracy
 * right at a DST transition isn't guaranteed.
 */
function zonedWallClockToUtc(dt: IcsDateTime, timeZone: string): Date {
  const guess = Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second);
  if (timeZone === "UTC") return new Date(guess);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const readsAs = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return new Date(guess - (readsAs - guess));
}

/** The true UTC instant this wall-clock value represents, applying the club's default zone to floating times. */
function toUtcInstant(dt: IcsDateTime): Date {
  if (dt.allDay) return new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
  return zonedWallClockToUtc(dt, dt.timeZone ?? DEFAULT_TIME_ZONE);
}

/**
 * `rrule` does its calendar arithmetic (weekday/month patterns) on a Date's
 * UTC getters — feeding it the wall-clock numbers "as if" they were UTC is
 * the library's documented way to keep that arithmetic anchored to the
 * event's own local calendar, independent of its real zone.
 */
function toRRuleUtc(dt: IcsDateTime): Date {
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second));
}

function fromRRuleUtc(date: Date, allDay: boolean, timeZone: string | null): IcsDateTime {
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    allDay, timeZone,
  };
}

interface RawVEvent {
  uid: string;
  start: IcsDateTime;
  end: IcsDateTime | null;
  rrule: string | null;
  exdates: IcsDateTime[];
  isRecurrenceOverride: boolean;
}

function parseVEvents(lines: string[]): RawVEvent[] {
  const events: RawVEvent[] = [];
  let current: {
    uid: string | null;
    start: IcsDateTime | null;
    end: IcsDateTime | null;
    rrule: string | null;
    exdates: IcsDateTime[];
    isRecurrenceOverride: boolean;
  } | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = { uid: null, start: null, end: null, rrule: null, exdates: [], isRecurrenceOverride: false };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.start) {
        events.push({
          uid: current.uid,
          start: current.start,
          end: current.end,
          rrule: current.rrule,
          exdates: current.exdates,
          isRecurrenceOverride: current.isRecurrenceOverride,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const prop = parseLine(line);
    if (!prop) continue;

    switch (prop.name) {
      case "UID":
        current.uid = prop.value;
        break;
      case "DTSTART":
        current.start = parseIcsDateTime(prop);
        break;
      case "DTEND":
        current.end = parseIcsDateTime(prop);
        break;
      case "RRULE":
        current.rrule = prop.value;
        break;
      case "EXDATE":
        // EXDATE can list several comma-separated values on one property.
        for (const value of prop.value.split(",")) {
          const parsed = parseIcsDateTime({ ...prop, value });
          if (parsed) current.exdates.push(parsed);
        }
        break;
      case "RECURRENCE-ID":
        current.isRecurrenceOverride = true;
        break;
    }
  }

  return events;
}

/** The Europe/Paris calendar days from `startInstant` through `startInstant + durationMs` (inclusive), clipped to the window — for *timed* events only. */
function daysCoveredByInstant(
  startInstant: Date,
  durationMs: number,
  windowStart: CalendarDate,
  windowEnd: CalendarDate,
): CalendarDate[] {
  const endInstant = new Date(startInstant.getTime() + Math.max(durationMs, 0));
  const startDay = fromTimestamp(startInstant);
  // DTEND is exclusive per RFC 5545 — back off one millisecond so an event
  // ending exactly on the hour doesn't spill into the next day.
  const endDay = fromTimestamp(new Date(Math.max(endInstant.getTime() - 1, startInstant.getTime())));

  const days: CalendarDate[] = [];
  let cursor = startDay;
  while (compare(cursor, endDay) <= 0) {
    if (compare(cursor, windowStart) >= 0 && compare(cursor, windowEnd) <= 0) {
      days.push(cursor);
    }
    if (compare(cursor, windowEnd) > 0) break;
    cursor = addDays(cursor, 1);
  }
  return days;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Reads the (y, m, d) an "as-if-UTC" occurrence Date represents directly — no zone involved, which is exactly right for a DATE-only value that has no timezone of its own per RFC 5545. */
function calendarDateFromUtcParts(date: Date): CalendarDate {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}` as CalendarDate;
}

/** The calendar days an all-day occurrence covers, clipped to the window — pure date arithmetic, deliberately never routed through a UTC-instant/timezone conversion (see the bug this was fixed from: a UTC midnight-to-midnight span reads as spilling into the next day in any zone ahead of UTC). */
function daysCoveredAllDay(
  occurrenceStart: Date,
  durationDays: number,
  windowStart: CalendarDate,
  windowEnd: CalendarDate,
): CalendarDate[] {
  const days: CalendarDate[] = [];
  let cursor = calendarDateFromUtcParts(occurrenceStart);
  for (let i = 0; i < Math.max(durationDays, 1); i++) {
    if (compare(cursor, windowStart) >= 0 && compare(cursor, windowEnd) <= 0) {
      days.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * Every occurrence of `event` (expanding RRULE if present) that overlaps
 * `[windowStart, windowEnd]`, expressed as the Europe/Paris calendar days it
 * covers — the only thing "l'agenda en commun" ever needs to know.
 */
function expandEventBusyDays(event: RawVEvent, windowStart: CalendarDate, windowEnd: CalendarDate): CalendarDate[] {
  const allDay = event.start.allDay;
  const durationMs = event.end
    ? toUtcInstant(event.end).getTime() - toUtcInstant(event.start).getTime()
    : allDay
      ? 24 * 60 * 60 * 1000
      : 0;
  const windowStartMs = new Date(`${windowStart}T00:00:00Z`).getTime();
  const windowEndMs = new Date(`${windowEnd}T23:59:59Z`).getTime();

  const occurrenceStarts: Date[] = [];

  if (event.rrule) {
    try {
      const dtstart = toRRuleUtc(event.start);
      const options = RRule.parseString(event.rrule);
      const set = new RRuleSet();
      set.rrule(new RRule({ ...options, dtstart }));
      for (const exdate of event.exdates) {
        set.exdate(toRRuleUtc(exdate));
      }
      // Pad the search start by the event's own duration so an occurrence
      // that starts before the window but runs into it is still counted.
      const padStart = new Date(windowStartMs - Math.max(durationMs, 0) - 24 * 60 * 60 * 1000);
      for (const occurrence of set.between(padStart, new Date(windowEndMs), true)) {
        occurrenceStarts.push(occurrence);
      }
    } catch {
      return [];
    }
  } else {
    occurrenceStarts.push(toRRuleUtc(event.start));
  }

  const days = new Set<CalendarDate>();
  for (const occurrenceStart of occurrenceStarts) {
    if (allDay) {
      const durationDays = Math.round(durationMs / (24 * 60 * 60 * 1000));
      for (const day of daysCoveredAllDay(occurrenceStart, durationDays, windowStart, windowEnd)) {
        days.add(day);
      }
    } else {
      const wallClock = fromRRuleUtc(occurrenceStart, false, event.start.timeZone);
      const startInstant = toUtcInstant(wallClock);
      for (const day of daysCoveredByInstant(startInstant, durationMs, windowStart, windowEnd)) {
        days.add(day);
      }
    }
  }

  return [...days];
}

/**
 * Every calendar day within `[windowStart, windowEnd]` on which this feed
 * has at least one event. Skips RECURRENCE-ID override blocks (a single
 * occurrence of a recurring series moved or renamed) — a rare edge case not
 * worth the complexity for a busy/free overview.
 */
export function parseBusyDays(icsText: string, windowStart: CalendarDate, windowEnd: CalendarDate): Set<CalendarDate> {
  const events = parseVEvents(unfoldLines(icsText)).filter((e) => !e.isRecurrenceOverride);
  const busy = new Set<CalendarDate>();
  for (const event of events) {
    for (const day of expandEventBusyDays(event, windowStart, windowEnd)) {
      busy.add(day);
    }
  }
  return busy;
}

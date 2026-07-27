import { describe, expect, it } from "vitest";
import { parse, type CalendarDate } from "@/core/date";
import { parseBusyDays } from "./parse";

function ics(events: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
}

function vevent(lines: string[]): string {
  return ["BEGIN:VEVENT", `UID:${Math.random().toString(36).slice(2)}@test`, ...lines, "END:VEVENT"].join("\r\n");
}

function d(s: string): CalendarDate {
  return parse(s);
}

describe("parseBusyDays", () => {
  const window = { start: d("2026-08-01"), end: d("2026-08-31") };

  it("marks a single UTC timed event's day as busy", () => {
    const text = ics([vevent(["DTSTART:20260815T170000Z", "DTEND:20260815T190000Z"])]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-15")]));
  });

  it("marks an all-day event's day as busy, not the exclusive DTEND day", () => {
    const text = ics([vevent(["DTSTART;VALUE=DATE:20260815", "DTEND;VALUE=DATE:20260816"])]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-15")]));
  });

  it("marks every day of a multi-day all-day event", () => {
    const text = ics([vevent(["DTSTART;VALUE=DATE:20260815", "DTEND;VALUE=DATE:20260818"])]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-15"), d("2026-08-16"), d("2026-08-17")]));
  });

  it("ignores an event entirely outside the window", () => {
    const text = ics([vevent(["DTSTART:20260901T100000Z", "DTEND:20260901T110000Z"])]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set());
  });

  it("handles a TZID-qualified event (Europe/Paris, UTC+2 in August)", () => {
    // 23:30 Paris time on the 15th is still the 15th in Paris, but would be
    // the 16th if it had been misread as a floating/UTC time.
    const text = ics([
      vevent(["DTSTART;TZID=Europe/Paris:20260815T233000", "DTEND;TZID=Europe/Paris:20260816T003000"]),
    ]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-15"), d("2026-08-16")]));
  });

  it("treats a floating time (no TZID, no Z) as the club's default zone", () => {
    const text = ics([vevent(["DTSTART:20260815T090000", "DTEND:20260815T100000"])]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-15")]));
  });

  it("expands a weekly recurring event across the window", () => {
    const text = ics([
      vevent(["DTSTART:20260803T180000Z", "DTEND:20260803T190000Z", "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=5"]),
    ]);
    const busy = parseBusyDays(text, window.start, window.end);
    // Mondays 08-03, 08-10, 08-17, 08-24, 08-31.
    expect(busy).toEqual(
      new Set([d("2026-08-03"), d("2026-08-10"), d("2026-08-17"), d("2026-08-24"), d("2026-08-31")]),
    );
  });

  it("excludes an EXDATE occurrence from a recurring series", () => {
    const text = ics([
      vevent([
        "DTSTART:20260803T180000Z",
        "DTEND:20260803T190000Z",
        "RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3",
        "EXDATE:20260810T180000Z",
      ]),
    ]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-03"), d("2026-08-17")]));
  });

  it("stops an UNTIL-bounded recurrence correctly", () => {
    const text = ics([
      vevent([
        "DTSTART:20260803T180000Z",
        "DTEND:20260803T190000Z",
        "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260812T000000Z",
      ]),
    ]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-03"), d("2026-08-10")]));
  });

  it("combines busy days across multiple events", () => {
    const text = ics([
      vevent(["DTSTART:20260805T100000Z", "DTEND:20260805T110000Z"]),
      vevent(["DTSTART:20260806T100000Z", "DTEND:20260806T110000Z"]),
    ]);
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-05"), d("2026-08-06")]));
  });

  it("skips a malformed event with no UID or DTSTART instead of throwing", () => {
    const text = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Broken", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    expect(() => parseBusyDays(text, window.start, window.end)).not.toThrow();
    expect(parseBusyDays(text, window.start, window.end)).toEqual(new Set());
  });

  it("unfolds a continuation line without corrupting the following property", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:folded@test",
      "SUMMARY:A very long summary that wraps onto",
      " a continuation line per RFC 5545",
      "DTSTART:20260812T100000Z",
      "DTEND:20260812T110000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const busy = parseBusyDays(text, window.start, window.end);
    expect(busy).toEqual(new Set([d("2026-08-12")]));
  });

  it("returns an empty set for a feed with no events", () => {
    const text = ics([]);
    expect(parseBusyDays(text, window.start, window.end)).toEqual(new Set());
  });
});

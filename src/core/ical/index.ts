/**
 * Minimal RFC 5545 serialization — just enough for a read-only feed of
 * all-day events. No recurrence, no timezones: every date here is a
 * `CalendarDate`-shaped "YYYY-MM-DD", civil days like the rest of the app.
 */
export interface IcsEvent {
  uid: string;
  summary: string;
  /** Inclusive first day. */
  startDate: string;
  /** Exclusive — the day *after* the event's last day, per RFC 5545 DTEND semantics. */
  endDateExclusive: string;
  description?: string;
}

function toIcsDate(date: string): string {
  return date.replaceAll("-", "");
}

/** Escapes the handful of characters ICS text values treat specially. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

export function buildIcsCalendar(calendarName: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LE CLHUB//Pretotheque//FR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.startDate)}`,
      `DTEND;VALUE=DATE:${toIcsDate(event.endDateExclusive)}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}

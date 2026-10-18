/**
 * "il y a 5 min", "hier à 22:00" — how recent something is, in words, for the
 * activity feed and notifications. Pure: `now` is a parameter so every case
 * is unit-testable.
 *
 * Always read in Paris time, not the server's: the container runs in UTC, and
 * both "which day is it?" and the hour shown must match what a member in
 * France sees on their own clock.
 */
const TIME_ZONE = "Europe/Paris";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourMinute = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const fullDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Whole calendar days between two instants, as read on a Paris clock. */
function calendarDaysBetween(earlier: Date, later: Date): number {
  const toUtcDay = (d: Date) => {
    const [y, m, day] = dayKey.format(d).split("-").map(Number);
    return Date.UTC(y as number, (m as number) - 1, day as number);
  };
  return Math.round((toUtcDay(later) - toUtcDay(earlier)) / (24 * HOUR));
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - date.getTime();

  if (elapsed < 45_000) return "à l'instant"; // also covers a clock a few seconds ahead
  if (elapsed < HOUR) return `il y a ${Math.max(1, Math.round(elapsed / MINUTE))} min`;
  if (elapsed < 6 * HOUR) return `il y a ${Math.round(elapsed / HOUR)} h`;

  const days = calendarDaysBetween(date, now);
  const time = hourMinute.format(date);
  if (days <= 0) return `aujourd'hui à ${time}`;
  if (days === 1) return `hier à ${time}`;
  if (days < 7) return `${weekday.format(date)} à ${time}`;

  const sameYear = dayKey.format(date).slice(0, 4) === dayKey.format(now).slice(0, 4);
  return (sameYear ? dayMonth : dayMonthYear).format(date);
}

/** The exact moment, for a tooltip behind the relative wording. */
export function formatExact(date: Date): string {
  return fullDate.format(date);
}

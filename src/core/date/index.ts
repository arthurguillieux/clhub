/**
 * Pure calendar-date arithmetic on `YYYY-MM-DD` strings — never `Date`, never `date-fns`.
 *
 * Booking ranges are civil dates, not instants: "the 12th to the 14th" means the same
 * thing regardless of time zone. Routing this through `Date` (always an instant, always
 * tied to a zone) is exactly how off-by-one-day bugs get into every home-grown calendar.
 *
 * All arithmetic below uses Howard Hinnant's days-from-civil / civil-from-days algorithm:
 * integer-only, correct across the whole proleptic Gregorian calendar (leap years included),
 * no floating point, no `Date` object anywhere.
 * http://howardhinnant.github.io/date_algorithms.html
 */

export type CalendarDate = string & { readonly __brand: "CalendarDate" };

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Civil {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Days since the Unix epoch (1970-01-01), for any proleptic Gregorian civil date. */
function daysFromCivil({ year, month, day }: Civil): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400; // [0, 399]
  const mp = (month + 9) % 12; // [0, 11], Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

/** Inverse of `daysFromCivil`. */
function civilFromDays(z: number): Civil {
  const zAdj = z + 719468;
  const era = Math.floor((zAdj >= 0 ? zAdj : zAdj - 146096) / 146097);
  const doe = zAdj - era * 146097; // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  ); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  const year = month <= 2 ? y + 1 : y;
  return { year, month, day };
}

function toCivil(date: CalendarDate): Civil {
  const match = PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid CalendarDate: "${date}" is not in YYYY-MM-DD format`);
  }
  const [, y, m, d] = match as unknown as [string, string, string, string];
  return { year: Number(y), month: Number(m), day: Number(d) };
}

function fromCivil(civil: Civil): CalendarDate {
  return `${pad2(civil.year).padStart(4, "0")}-${pad2(civil.month)}-${pad2(civil.day)}` as CalendarDate;
}

/** Parses and validates a `YYYY-MM-DD` string, rejecting calendar dates that don't exist (e.g. Feb 30). */
export function parse(input: string): CalendarDate {
  const civil = toCivil(input as CalendarDate);
  const roundTripped = civilFromDays(daysFromCivil(civil));
  if (
    roundTripped.year !== civil.year ||
    roundTripped.month !== civil.month ||
    roundTripped.day !== civil.day
  ) {
    throw new Error(`Invalid CalendarDate: "${input}" does not exist on the calendar`);
  }
  return input as CalendarDate;
}

/** Identity for a valid `CalendarDate` — exists for symmetry with `parse` at API boundaries. */
export function format(date: CalendarDate): string {
  return date;
}

/** "DD/MM/YYYY" for user-facing display — ISO stays canonical everywhere else (storage, URLs, forms). */
export function formatFrench(date: CalendarDate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** The civil date a given instant falls on, in the given IANA time zone. */
export function fromTimestamp(instant: Date, timeZone: string = "Europe/Paris"): CalendarDate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD.
  return parse(formatter.format(instant));
}

/** Today's civil date in the given IANA time zone. The only place "now" enters this module. */
export function today(timeZone: string = "Europe/Paris"): CalendarDate {
  return fromTimestamp(new Date(), timeZone);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromCivil(civilFromDays(daysFromCivil(toCivil(date)) + days));
}

/** Number of days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: CalendarDate, b: CalendarDate): number {
  return daysFromCivil(toCivil(b)) - daysFromCivil(toCivil(a));
}

/** Lexicographic order on zero-padded ISO dates is chronological order — no arithmetic needed. */
export function compare(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBefore(a: CalendarDate, b: CalendarDate): boolean {
  return a < b;
}

export function isAfter(a: CalendarDate, b: CalendarDate): boolean {
  return a > b;
}

/** Every date from `start` to `end`, inclusive. */
export function eachDay(start: CalendarDate, end: CalendarDate): CalendarDate[] {
  const count = diffDays(start, end);
  if (count < 0) {
    throw new Error(`eachDay: start (${start}) is after end (${end})`);
  }
  const days: CalendarDate[] = [];
  for (let i = 0; i <= count; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

export function startOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = toCivil(date);
  return fromCivil({ year, month, day: 1 });
}

export function endOfMonth(date: CalendarDate): CalendarDate {
  const { year, month } = toCivil(date);
  const firstOfNextMonth =
    month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  return addDays(fromCivil(firstOfNextMonth), -1);
}

/** ISO weekday: 1 = Monday, ..., 7 = Sunday. */
export function weekday(date: CalendarDate): number {
  const days = daysFromCivil(toCivil(date));
  // 1970-01-01 was a Thursday (ISO weekday 4).
  return ((((days + 3) % 7) + 7) % 7) + 1;
}

export function isWeekend(date: CalendarDate): boolean {
  const day = weekday(date);
  return day === 6 || day === 7;
}

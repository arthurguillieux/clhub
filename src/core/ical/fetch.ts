import { readLimited, safeFetch } from "@/core/net/urlSafety";
import { parseBusyDays } from "./parse";
import type { CalendarDate } from "@/core/date";

/**
 * `null` means "couldn't read this feed" (bad URL, unreachable, not an
 * ICS file, malformed) — distinct from an empty `Set`, which genuinely
 * means "no events in this window". Callers treat `null` as "exclude this
 * member from the count", not as "they're free".
 */
export async function fetchBusyDays(
  rawUrl: string,
  windowStart: CalendarDate,
  windowEnd: CalendarDate,
): Promise<Set<CalendarDate> | null> {
  let text: string;
  try {
    const res = await safeFetch(rawUrl, { timeoutMs: 8000 });
    if (!res?.ok) return null;
    const body = await readLimited(res, 20_000_000);
    if (!body) return null;
    text = body.toString("utf8");
  } catch {
    return null;
  }

  try {
    return parseBusyDays(text, windowStart, windowEnd);
  } catch {
    return null;
  }
}

import { isSafeExternalUrl } from "@/core/net/urlSafety";
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
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isSafeExternalUrl(url)) return null;

  let text: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeCLHUBBot/1.0)" },
    });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }

  try {
    return parseBusyDays(text, windowStart, windowEnd);
  } catch {
    return null;
  }
}

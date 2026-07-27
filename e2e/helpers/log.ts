import { readFileSync } from "node:fs";
import { LOG_FILE } from "../global-setup";

const URL_PATTERN = /https?:\/\/\S+/;

/**
 * Polls the captured dev-server log for a URL that `sendMail`'s
 * `devFallbackMessage` fallback logged after some marker text (see
 * core/mail/send.ts) — this is the exact link a real email would have
 * contained, since RESEND_API_KEY is forced empty for the whole e2e run
 * (see global-setup.ts). Searches from the marker's position onward rather
 * than assuming same-line vs. next-line — call sites format this
 * differently (":\n" for magic links/invitations, " — " for booking mails).
 */
export async function waitForLoggedUrl(marker: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const content = readFileSync(LOG_FILE, "utf-8");
    const markerIndex = content.lastIndexOf(marker);
    if (markerIndex !== -1) {
      const after = content.slice(markerIndex + marker.length);
      const match = URL_PATTERN.exec(after);
      if (match) return match[0].trim();
    }
    if (Date.now() > deadline) {
      throw new Error(`No URL found after marker "${marker}" in the server log within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

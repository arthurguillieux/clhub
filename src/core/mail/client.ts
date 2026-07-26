import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily constructed so the app can boot (and /api/health can respond) even
 * before RESEND_API_KEY is configured — only actually sending an email requires it.
 */
export function getMailClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing required environment variable: RESEND_API_KEY");
    }
    client = new Resend(apiKey);
  }
  return client;
}

export function requireMailFrom(): string {
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new Error("Missing required environment variable: MAIL_FROM");
  }
  return from;
}

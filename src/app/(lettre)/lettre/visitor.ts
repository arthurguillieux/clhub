import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The family has no account: a random key in a cookie tells apart what was given from this browser,
 * so its author — and only them — can take it back. Not a "use server" file: nothing here may be
 * called from the browser.
 */
const VISITOR_COOKIE = "lettre_visiteur";

export async function readVisitorKey(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && /^[\w-]{20,64}$/.test(value) ? value : null;
}

/** From a server action only: a Server Component can't set a cookie. */
export async function ensureVisitorKey(): Promise<string> {
  const existing = await readVisitorKey();
  if (existing) return existing;
  const key = randomBytes(24).toString("base64url");
  (await cookies()).set(VISITOR_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/lettre",
    maxAge: 60 * 60 * 24 * 400,
  });
  return key;
}

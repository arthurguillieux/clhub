import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/**
 * The admin area sits behind two independent gates: `member.role === 'admin'`
 * (who), and a short-lived unlock cookie set after the 3-click-on-the-logo
 * gesture + code (when). Neither alone is enough — an admin's session
 * cookie leaking doesn't hand over destructive actions, and knowing the
 * code doesn't help someone who isn't a club admin.
 */
const COOKIE_NAME = "clhub_admin_unlock";
const UNLOCK_DURATION_MS = 4 * 60 * 60 * 1000; // 4h — long enough for one admin session, short enough to matter

function sign(value: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verifies the code typed after the 3-click gesture; sets the unlock cookie on success. */
export async function unlockAdmin(code: string): Promise<boolean> {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected || !safeEqual(code, expected)) return false;

  const expiresAt = Date.now() + UNLOCK_DURATION_MS;
  const payload = String(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_DURATION_MS / 1000,
  });
  return true;
}

async function hasValidUnlockCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

/** Guards every admin page and action. Redirects home rather than revealing why — no distinction shown between "not admin" and "not unlocked". */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.member.role !== "admin" || !(await hasValidUnlockCookie())) {
    redirect("/");
  }
  return session;
}

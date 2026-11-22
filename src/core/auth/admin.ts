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
/**
 * « Voir comme un membre »: an unlocked admin sees the CLHUB as an ordinary member does, powers off,
 * until they come back (without the code again, while the unlock lasts). It only ever takes powers
 * away, so it needs no signature.
 */
const VIEW_COOKIE = "clhub_view_as_member";
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
  // .trim() on both sides: env files edited on Windows (CRLF line endings)
  // can leave a trailing \r on the value, which timingSafeEqual then fails
  // on for every input, pasted or not, since the lengths never match.
  const expected = process.env.ADMIN_ACCESS_CODE?.trim();
  if (!expected || !safeEqual(code.trim(), expected)) return false;

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

async function isViewingAsMember(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(VIEW_COOKIE)?.value === "1";
}

/** Guards every admin page and action. Redirects home rather than revealing why — no distinction shown between "not admin" and "not unlocked". */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.member.role !== "admin" || !(await hasValidUnlockCookie()) || (await isViewingAsMember())) {
    redirect("/");
  }
  return session;
}

/**
 * Same two-factor check as requireAdmin (admin role + live unlock cookie),
 * but returning a boolean instead of redirecting — for UI (the site-wide
 * admin-mode banner) that needs to know without gating the page itself.
 */
export async function isAdminModeActive(): Promise<boolean> {
  const session = await getSession();
  if (!session || session.member.role !== "admin") return false;
  if (await isViewingAsMember()) return false;
  return hasValidUnlockCookie();
}

/** What the banner shows: admin mode, the member's view of an admin, or nothing. */
export async function adminBannerState(): Promise<"admin" | "member-view" | null> {
  const session = await getSession();
  if (!session || session.member.role !== "admin" || !(await hasValidUnlockCookie())) return null;
  return (await isViewingAsMember()) ? "member-view" : "admin";
}

/** « Voir comme un membre » on or off; only an unlocked admin can turn it on. */
export async function setViewAsMember(on: boolean): Promise<void> {
  const cookieStore = await cookies();
  if (!on) {
    cookieStore.delete(VIEW_COOKIE);
    return;
  }
  const session = await getSession();
  if (!session || session.member.role !== "admin" || !(await hasValidUnlockCookie())) return;
  cookieStore.set(VIEW_COOKIE, "1", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: UNLOCK_DURATION_MS / 1000 });
}

/** Ends the current unlock early, without waiting out the 4h expiry. */
export async function lockAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete(VIEW_COOKIE);
}

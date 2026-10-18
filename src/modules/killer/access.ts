import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * The Killer is hidden behind a password so club members coming to the party
 * don't spoil the surprise — admins included, which is why this isn't the
 * admin code. The repo is public and Arthur is fine with that; only the
 * SHA-256 fingerprint is written here so a glance at GitHub doesn't give it away.
 */
const PASSWORD_SHA256 = "61c0cd3e67ed626547648fb3d32c04997c55b107c8c28b80a68af4fe947489ed";
const COOKIE_NAME = "clhub_killer_access";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 60;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const sign = (value: string) => crypto.createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(value).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function isKillerPassword(input: string): boolean {
  return safeEqual(sha256(input.trim().toLowerCase()), PASSWORD_SHA256);
}

/** Bound to the member, so one person's cookie can't be copied onto another account. */
export async function grantKillerAccess(memberId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(`killer:${memberId}`), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
}

export async function hasKillerAccess(memberId: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return !!value && safeEqual(value, sign(`killer:${memberId}`));
}

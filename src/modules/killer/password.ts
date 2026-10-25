import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * A game's co-organization password: whoever knows it can help run the game. Stored salted and
 * hashed (scrypt), "salt:hash" in hex — never as typed. Compared case-insensitively and without
 * surrounding spaces, since it gets passed on by word of mouth.
 */
const normalise = (password: string) => password.trim().toLowerCase();

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(normalise(password), salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(normalise(password), Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

import { createHash, randomBytes } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/core/db/client";
import { actionToken, type ActionToken } from "@/core/db/schema";

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days, matching invitations

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the raw token once — only its hash is ever persisted. */
export async function createActionToken(
  memberId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(actionToken).values({
    tokenHash: hashToken(token),
    memberId,
    action,
    payload,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

export type ActionTokenLookup =
  | { ok: true; row: ActionToken }
  | { ok: false; reason: "not-found" | "expired" | "used" };

export async function lookupActionToken(token: string): Promise<ActionTokenLookup> {
  const row = await db.query.actionToken.findFirst({
    where: (t, { eq }) => eq(t.tokenHash, hashToken(token)),
  });
  if (!row) return { ok: false, reason: "not-found" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  return { ok: true, row };
}

/** Also serves to invalidate a token that was never legitimately "used" — see below. */
export async function consumeActionToken(id: string): Promise<void> {
  await db.update(actionToken).set({ usedAt: new Date() }).where(eq(actionToken.id, id));
}

/**
 * A booking request mints two tokens (approve + reject) for the same owner.
 * Once one is acted on, the other must stop working — otherwise the owner
 * could open both links from the email and fire the opposite action after
 * already deciding. Matches by a payload field since these are low-volume,
 * per-member rows; no need for a JSONB query operator.
 */
export async function invalidateSiblingTokens(
  memberId: string,
  payloadKey: string,
  payloadValue: string,
  exceptId: string,
): Promise<void> {
  const candidates = await db.query.actionToken.findMany({
    where: (t, { eq }) => and(eq(t.memberId, memberId), isNull(t.usedAt)),
  });
  for (const candidate of candidates) {
    if (candidate.id === exceptId) continue;
    const payload = candidate.payload as Record<string, unknown>;
    if (payload[payloadKey] === payloadValue) {
      await consumeActionToken(candidate.id);
    }
  }
}

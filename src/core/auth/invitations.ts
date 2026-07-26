import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/core/db/client";
import { invitation, member, type Invitation } from "@/core/db/schema";

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the raw token once — only the hash is persisted, mirroring action_token. */
export async function createInvitation(
  email: string,
  invitedById: string,
): Promise<{ invitation: Invitation; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(invitation)
    .values({
      email: email.toLowerCase().trim(),
      tokenHash: hashToken(token),
      invitedById,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create invitation");
  }
  return { invitation: row, token };
}

export async function findInvitationByToken(token: string): Promise<Invitation | null> {
  const [row] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.tokenHash, hashToken(token)))
    .limit(1);
  return row ?? null;
}

/** Most recent still-valid (unexpired, unaccepted) invitation for an email, if any. */
export async function findValidInvitationByEmail(email: string): Promise<Invitation | null> {
  const [row] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.email, email.toLowerCase().trim()),
        isNull(invitation.acceptedAt),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitation.createdAt))
    .limit(1);
  return row ?? null;
}

export async function markInvitationAccepted(id: string): Promise<void> {
  await db.update(invitation).set({ acceptedAt: new Date() }).where(eq(invitation.id, id));
}

/** Bootstrap escape hatch: the very first member can't have been invited by anyone. */
export async function clubHasNoMembersYet(): Promise<boolean> {
  const [row] = await db.select({ id: member.id }).from(member).limit(1);
  return !row;
}

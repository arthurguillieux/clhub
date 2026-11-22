import { desc, eq, inArray } from "drizzle-orm";
import { createInvitation } from "@/core/auth/invitations";
import { db } from "@/core/db/client";
import { invitation, member, user } from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { InvitationEmail } from "@/core/mail/templates/InvitationEmail";

/**
 * The invitations sent to join the club: who invited whom, whether they joined, and sending one
 * again. A member sees the addresses they invited; the admin sees them all.
 */

export type Result = { ok: true } | { ok: false; error: string };

const normalize = (email: string) => email.toLowerCase().trim();
const RESEND_DELAY_MS = 10 * 60 * 1000;

/** The address already belongs to a member: no invitation needed. */
async function memberNamed(email: string): Promise<string | null> {
  const [row] = await db.select({ name: user.name }).from(user).where(eq(user.email, normalize(email))).limit(1);
  return row?.name ?? null;
}

/** One invitation: a fresh link (14 days) by mail. Refused when the address is already a member's. */
export async function sendInvitation(inviterId: string, inviterName: string, rawEmail: string): Promise<Result> {
  const email = normalize(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Adresse mail invalide." };
  const already = await memberNamed(email);
  if (already) return { ok: false, error: `${email} est déjà membre du CLHUB (${already}).` };
  const { invitation: created, token } = await createInvitation(email, inviterId);
  const url = `${process.env.APP_URL}/invitations/${token}`;
  await sendMail({
    to: created.email,
    subject: "LE CLHUB — tu es invité·e",
    react: InvitationEmail({ inviterName, url }),
    devFallbackMessage: `Invitation link for ${created.email}:\n${url}`,
  });
  return { ok: true };
}

export interface InvitedAddress {
  email: string;
  /** Who invited this address (several people may have). */
  inviters: string[];
  firstSentAt: Date;
  lastSentAt: Date;
  sends: number;
  /** The last link's end of validity. */
  expiresAt: Date;
  status: "joined" | "pending" | "expired";
  /** When they're a member now: their name, and since when. */
  joined: { name: string; since: Date } | null;
}

/** The addresses invited (by one member, or by anyone): one line per address, waiting ones first. */
export async function listInvitations(invitedBy: string | null): Promise<InvitedAddress[]> {
  const rows = await db
    .select({ email: invitation.email, createdAt: invitation.createdAt, expiresAt: invitation.expiresAt, inviter: user.name })
    .from(invitation)
    .innerJoin(member, eq(member.id, invitation.invitedById))
    .innerJoin(user, eq(user.id, member.userId))
    .where(invitedBy ? eq(invitation.invitedById, invitedBy) : undefined)
    .orderBy(desc(invitation.createdAt));
  if (!rows.length) return [];
  const emails = [...new Set(rows.map((r) => r.email))];
  const joined = await db
    .select({ email: user.email, name: user.name, since: member.createdAt })
    .from(user)
    .innerJoin(member, eq(member.userId, user.id))
    .where(inArray(user.email, emails));
  const now = Date.now();
  const order = { pending: 0, expired: 1, joined: 2 } as const;
  return emails
    .map((email): InvitedAddress => {
      const mine = rows.filter((r) => r.email === email);
      const last = mine[0]!;
      const who = joined.find((j) => j.email === email);
      return {
        email,
        inviters: [...new Set(mine.map((r) => r.inviter))],
        firstSentAt: mine.at(-1)!.createdAt,
        lastSentAt: last.createdAt,
        sends: mine.length,
        expiresAt: last.expiresAt,
        status: who ? "joined" : last.expiresAt.getTime() > now ? "pending" : "expired",
        joined: who ? { name: who.name, since: who.since } : null,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || b.lastSentAt.getTime() - a.lastSentAt.getTime());
}

/** « Renvoyer l'invitation »: a new link, for an address this member invited (any, for the admin). */
export async function resendInvitation(memberId: string, memberName: string, rawEmail: string, admin: boolean): Promise<Result> {
  const email = normalize(rawEmail);
  const sent = (await listInvitations(admin ? null : memberId)).find((i) => i.email === email);
  if (!sent) return { ok: false, error: "Tu n'as pas invité cette adresse." };
  if (sent.status === "joined") return { ok: false, error: `${sent.joined?.name ?? email} a déjà rejoint le CLHUB.` };
  if (Date.now() - sent.lastSentAt.getTime() < RESEND_DELAY_MS) return { ok: false, error: "L'invitation vient de partir : attends quelques minutes avant de la renvoyer." };
  return sendInvitation(memberId, memberName, email);
}

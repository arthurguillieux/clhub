import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import {
  member,
  santaCohost,
  santaEvent,
  santaExclusion,
  santaParticipant,
  santaQuestion,
  santaUnmask,
  user,
  type SantaEvent,
  type SantaParticipant,
} from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { SantaInviteEmail, SantaNoticeEmail } from "@/core/mail/templates/SantaEmail";
import { hashPassword, verifyPassword } from "@/core/auth/sharedPassword";
import { asTheme, type SantaTheme } from "../themes";
import { MIN_PARTICIPANTS, draw, forbiddenPairs, nextYearTitle, type DrawResult, type Pair } from "../domain/draw";
import type { MeView, OrgView, SantaStatus } from "../views";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const LIMITS = { participants: 60, title: 80, name: 40, budget: 60, message: 1000, letter: 2000, question: 300, answer: 500, questionsPerGiver: 5 };

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

const newToken = () => randomBytes(24).toString("base64url");
const personalLink = (token: string) => `${process.env.APP_URL ?? "http://localhost:3000"}/santa/moi/${token}`;
const longDate = (date: string | null) =>
  date ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00Z`)) : null;

// ───────── Reading ─────────

export async function getEventByCode(code: string): Promise<SantaEvent | null> {
  const [event] = await db.select().from(santaEvent).where(eq(santaEvent.code, code.trim().toUpperCase())).limit(1);
  return event ?? null;
}

export async function isCohost(event: SantaEvent, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: santaCohost.id })
    .from(santaCohost)
    .where(and(eq(santaCohost.eventId, event.id), eq(santaCohost.memberId, memberId)))
    .limit(1);
  return !!row;
}

const loadParticipants = (eventId: string) => db.select().from(santaParticipant).where(eq(santaParticipant.eventId, eventId)).orderBy(asc(santaParticipant.createdAt));

/** What a member sees on Jeux › Secret Santa: what they organize, and what they take part in. */
export async function listForMember(memberId: string) {
  const cohosted = db.select({ eventId: santaCohost.eventId }).from(santaCohost).where(eq(santaCohost.memberId, memberId));
  const organized = await db
    .select()
    .from(santaEvent)
    .where(or(eq(santaEvent.hostMemberId, memberId), inArray(santaEvent.id, cohosted)))
    .orderBy(desc(santaEvent.createdAt));
  const participating = await db
    .select({ title: santaEvent.title, token: santaParticipant.token, archivedAt: santaEvent.archivedAt })
    .from(santaParticipant)
    .innerJoin(santaEvent, eq(santaEvent.id, santaParticipant.eventId))
    .where(and(eq(santaParticipant.memberId, memberId), eq(santaEvent.status, "launched"), isNull(santaEvent.archivedAt)))
    .orderBy(desc(santaEvent.launchedAt));
  return { organized: organized.map((e) => ({ ...e, role: e.hostMemberId === memberId ? ("host" as const) : ("cohost" as const) })), participating };
}

/** Why the draw can't run, in plain words; null when it can. */
function explain(result: Extract<DrawResult, { ok: false }>, nameOf: Map<string, string>): string {
  const names = (ids: string[]) => ids.map((id) => nameOf.get(id) ?? "?").join(", ");
  if (result.noRecipient.length) return `Avec ces exclusions, ${names(result.noRecipient)} ne peut tirer personne. Retire une règle.`;
  if (result.noGiver.length) return `Avec ces exclusions, personne ne peut tirer ${names(result.noGiver)}. Retire une règle.`;
  return "Ces exclusions rendent le tirage impossible : il n'existe aucune répartition qui les respecte toutes. Retire une règle.";
}

async function loadRules(eventId: string) {
  return db.select().from(santaExclusion).where(eq(santaExclusion.eventId, eventId));
}

function blockerOf(participants: SantaParticipant[], rules: { fromId: string; toId: string; mutual: boolean }[]): string | null {
  if (participants.length < MIN_PARTICIPANTS) return `Il faut au moins ${MIN_PARTICIPANTS} participants.`;
  const result = draw(
    participants.map((p) => p.id),
    forbiddenPairs(rules),
  );
  return result.ok ? null : explain(result, new Map(participants.map((p) => [p.id, p.name])));
}

export async function getOrgView(event: SantaEvent): Promise<OrgView> {
  const participants = await loadParticipants(event.id);
  const rules = await loadRules(event.id);
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const cohosts = await db
    .select({ memberId: santaCohost.memberId, name: user.name })
    .from(santaCohost)
    .innerJoin(member, eq(member.id, santaCohost.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(santaCohost.eventId, event.id))
    .orderBy(asc(santaCohost.createdAt));
  const unmasks = await db
    .select({ who: user.name, participantId: santaUnmask.participantId, at: santaUnmask.createdAt })
    .from(santaUnmask)
    .innerJoin(member, eq(member.id, santaUnmask.memberId))
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(santaUnmask.eventId, event.id))
    .orderBy(desc(santaUnmask.createdAt));
  const [previous] = event.previousEventId
    ? await db.select({ title: santaEvent.title }).from(santaEvent).where(eq(santaEvent.id, event.previousEventId)).limit(1)
    : [];
  return {
    code: event.code,
    title: event.title,
    status: event.status as SantaStatus,
    archived: !!event.archivedAt,
    budget: event.budget,
    exchangeDate: event.exchangeDate,
    message: event.message,
    theme: asTheme(event.theme),
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      isMember: !!p.memberId,
      email: p.memberId ? null : p.email,
      mailSent: !!p.mailSentAt,
      mailError: p.mailError,
      revealed: !!p.revealedAt,
    })),
    exclusions: rules.map((r) => ({ id: r.id, fromId: r.fromId, toId: r.toId, fromName: nameOf.get(r.fromId) ?? "?", toName: nameOf.get(r.toId) ?? "?", mutual: r.mutual })),
    cohosts,
    hasCohostPassword: !!event.cohostPassword,
    unmasks: unmasks.map((u) => ({ who: u.who, whom: nameOf.get(u.participantId) ?? "?", at: u.at.toISOString() })),
    blocker: event.status === "preparation" ? blockerOf(participants, rules) : null,
    previousTitle: previous?.title ?? null,
  };
}

// ───────── Organizing ─────────

export async function createEvent(hostMemberId: string, title: string): Promise<SantaEvent> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [event] = await db.insert(santaEvent).values({ code, hostMemberId, title }).onConflictDoNothing().returning();
    if (event) return event;
  }
}

export async function updateSettings(event: SantaEvent, s: { title: string; budget: string; exchangeDate: string | null; message: string }): Promise<Result> {
  await db
    .update(santaEvent)
    .set({ title: s.title.trim(), budget: s.budget.trim(), exchangeDate: s.exchangeDate || null, message: s.message.trim() })
    .where(eq(santaEvent.id, event.id));
  return { ok: true };
}

/** Allowed at any time, even after the draw: it only changes the look. */
export async function updateTheme(event: SantaEvent, theme: SantaTheme): Promise<Result> {
  await db.update(santaEvent).set({ theme }).where(eq(santaEvent.id, event.id));
  return { ok: true };
}

const inPreparation = (event: SantaEvent) => (event.status === "preparation" ? null : fail("Le tirage a déjà eu lieu : reviens à la préparation pour changer ça."));

async function checkNewParticipant(event: SantaEvent, name: string): Promise<Result> {
  const existing = await loadParticipants(event.id);
  if (existing.length >= LIMITS.participants) return fail(`${LIMITS.participants} participants au plus.`);
  if (existing.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return fail(`Il y a déjà un·e ${name.trim()} : ajoute une initiale pour les distinguer.`);
  }
  return { ok: true };
}

export async function addMemberParticipant(event: SantaEvent, memberId: string): Promise<Result> {
  const blocked = inPreparation(event);
  if (blocked) return blocked;
  const [found] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, memberId)).limit(1);
  if (!found) return fail("Membre introuvable.");
  const [already] = await db
    .select({ id: santaParticipant.id })
    .from(santaParticipant)
    .where(and(eq(santaParticipant.eventId, event.id), eq(santaParticipant.memberId, memberId)))
    .limit(1);
  if (already) return fail(`${found.name} participe déjà.`);
  const check = await checkNewParticipant(event, found.name);
  if (!check.ok) return check;
  await db.insert(santaParticipant).values({ eventId: event.id, memberId, name: found.name, token: newToken() });
  return { ok: true };
}

/** Someone outside the club, by email. If that address is a member's, they're added as the member they are. */
export async function addGuestParticipant(event: SantaEvent, name: string, email: string): Promise<Result> {
  const blocked = inPreparation(event);
  if (blocked) return blocked;
  const address = email.trim().toLowerCase();
  const [account] = await db.select({ memberId: member.id }).from(member).innerJoin(user, eq(user.id, member.userId)).where(sql`lower(${user.email}) = ${address}`).limit(1);
  if (account) return addMemberParticipant(event, account.memberId);
  const existing = await loadParticipants(event.id);
  if (existing.some((p) => p.email?.toLowerCase() === address)) return fail("Cette adresse participe déjà.");
  const check = await checkNewParticipant(event, name);
  if (!check.ok) return check;
  await db.insert(santaParticipant).values({ eventId: event.id, name: name.trim(), email: address, token: newToken() });
  return { ok: true };
}

/** Fixing a guest's name or address, even after the draw: a wrong address can be corrected and the mail sent again. */
export async function updateGuest(event: SantaEvent, id: string, name: string, email: string): Promise<Result> {
  const participants = await loadParticipants(event.id);
  const address = email.trim().toLowerCase();
  if (participants.some((p) => p.id !== id && p.email?.toLowerCase() === address)) return fail("Cette adresse participe déjà.");
  if (participants.some((p) => p.id !== id && p.name.trim().toLowerCase() === name.trim().toLowerCase())) return fail(`Il y a déjà un·e ${name.trim()}.`);
  await db
    .update(santaParticipant)
    .set({ name: name.trim(), email: address, mailError: null })
    .where(and(eq(santaParticipant.id, id), eq(santaParticipant.eventId, event.id), isNull(santaParticipant.memberId)));
  return { ok: true };
}

export async function removeParticipant(event: SantaEvent, id: string): Promise<Result> {
  const blocked = inPreparation(event);
  if (blocked) return blocked;
  await db.delete(santaParticipant).where(and(eq(santaParticipant.id, id), eq(santaParticipant.eventId, event.id)));
  return { ok: true };
}

export async function addExclusion(event: SantaEvent, fromId: string, toId: string, mutual: boolean): Promise<Result> {
  const blocked = inPreparation(event);
  if (blocked) return blocked;
  if (fromId === toId) return fail("Choisis deux personnes différentes.");
  const participants = await loadParticipants(event.id);
  if (!participants.some((p) => p.id === fromId) || !participants.some((p) => p.id === toId)) return fail("Participant introuvable.");
  const rules = await loadRules(event.id);
  if (rules.some((r) => (r.fromId === fromId && r.toId === toId) || (r.mutual && r.fromId === toId && r.toId === fromId))) return fail("Cette règle existe déjà.");
  await db.insert(santaExclusion).values({ eventId: event.id, fromId, toId, mutual });
  return { ok: true };
}

export async function removeExclusion(event: SantaEvent, id: string): Promise<Result> {
  const blocked = inPreparation(event);
  if (blocked) return blocked;
  await db.delete(santaExclusion).where(and(eq(santaExclusion.id, id), eq(santaExclusion.eventId, event.id)));
  return { ok: true };
}

export async function addCohost(event: SantaEvent, memberId: string): Promise<Result> {
  if (memberId === event.hostMemberId) return fail("Tu organises déjà ce Secret Santa.");
  await db.insert(santaCohost).values({ eventId: event.id, memberId }).onConflictDoNothing();
  return { ok: true };
}

export async function removeCohost(event: SantaEvent, memberId: string): Promise<Result> {
  await db.delete(santaCohost).where(and(eq(santaCohost.eventId, event.id), eq(santaCohost.memberId, memberId)));
  return { ok: true };
}

// ───────── The draw and the mails ─────────

/** Sets or removes the co-organization password. */
export async function setCohostPassword(event: SantaEvent, password: string | null): Promise<Result> {
  if (password !== null && password.trim().length < 4) return fail("Le mot de passe doit faire au moins 4 caractères.");
  await db
    .update(santaEvent)
    .set({ cohostPassword: password === null ? null : hashPassword(password) })
    .where(eq(santaEvent.id, event.id));
  return { ok: true };
}

/** A member types the co-organization password and joins the organization. */
export async function joinOrganization(event: SantaEvent, memberId: string, password: string): Promise<Result> {
  if (memberId === event.hostMemberId) return { ok: true };
  if (!event.cohostPassword) return fail("Ce Secret Santa n'a pas de mot de passe de co-organisation : demande à son organisateur de t'ajouter.");
  if (!verifyPassword(password, event.cohostPassword)) return fail("Ce n'est pas le bon mot de passe.");
  await db.insert(santaCohost).values({ eventId: event.id, memberId }).onConflictDoNothing();
  return { ok: true };
}

async function organizerName(event: SantaEvent): Promise<string> {
  const [row] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, event.hostMemberId)).limit(1);
  return row?.name ?? "Le CLHUB";
}

/** A participant's address: the one they gave, or their account's for a member. */
async function addressOf(p: SantaParticipant): Promise<string | null> {
  if (!p.memberId) return p.email;
  const [row] = await db.select({ email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, p.memberId)).limit(1);
  return row?.email ?? null;
}

/** Last year's pairs, carried over to this year's participants (matched by account or address). */
async function lastYearsPairs(event: SantaEvent, participants: SantaParticipant[]): Promise<Pair[]> {
  if (!event.previousEventId) return [];
  const previous = await loadParticipants(event.previousEventId);
  const identity = (p: SantaParticipant) => p.memberId ?? p.email?.toLowerCase() ?? p.id;
  const now = new Map(participants.map((p) => [identity(p), p.id]));
  const before = new Map(previous.map((p) => [p.id, identity(p)]));
  return previous.flatMap((p): Pair[] => {
    const giver = now.get(identity(p));
    const recipient = p.recipientId ? now.get(before.get(p.recipientId) ?? "") : undefined;
    return giver && recipient ? [[giver, recipient]] : [];
  });
}

async function sendInvite(event: SantaEvent, p: SantaParticipant, organizer: string): Promise<void> {
  const to = await addressOf(p);
  try {
    if (!to) throw new Error("Pas d'adresse mail");
    const link = personalLink(p.token);
    await sendMail({
      to,
      subject: `🎁 ${event.title} : découvre à qui tu offres ton cadeau`,
      react: SantaInviteEmail({ name: p.name, title: event.title, organizer, link, budget: event.budget, date: longDate(event.exchangeDate), message: event.message, theme: asTheme(event.theme) }),
      devFallbackMessage: `Secret Santa link for ${to}:\n${link}`,
    });
    await db.update(santaParticipant).set({ mailSentAt: new Date(), mailError: null }).where(eq(santaParticipant.id, p.id));
  } catch (error) {
    console.error("Secret Santa: mail not sent", error);
    await db.update(santaParticipant).set({ mailError: "Le mail n'est pas parti" }).where(eq(santaParticipant.id, p.id));
  }
}

/** Sends the mails one by one, gently (Resend takes two per second); a failure on one doesn't stop the others. */
async function sendInvites(event: SantaEvent, participants: SantaParticipant[]): Promise<void> {
  const organizer = await organizerName(event);
  for (const p of participants) {
    await sendInvite(event, p, organizer);
    if (process.env.RESEND_API_KEY) await new Promise((resolve) => setTimeout(resolve, 600));
  }
}

/** The big moment: draws, then mails everyone their link. */
export async function launchEvent(event: SantaEvent): Promise<Result> {
  if (event.status !== "preparation") return fail("Le tirage a déjà eu lieu.");
  const participants = await loadParticipants(event.id);
  const rules = await loadRules(event.id);
  if (participants.length < MIN_PARTICIPANTS) return fail(`Il faut au moins ${MIN_PARTICIPANTS} participants.`);
  const result = draw(
    participants.map((p) => p.id),
    forbiddenPairs(rules),
    await lastYearsPairs(event, participants),
  );
  if (!result.ok) return fail(explain(result, new Map(participants.map((p) => [p.id, p.name]))));
  await db.transaction(async (tx) => {
    for (const [giver, recipient] of result.pairs) await tx.update(santaParticipant).set({ recipientId: recipient }).where(eq(santaParticipant.id, giver));
    await tx.update(santaEvent).set({ status: "launched", launchedAt: new Date() }).where(eq(santaEvent.id, event.id));
  });
  await sendInvites(event, participants);
  return { ok: true };
}

export async function resendInvite(event: SantaEvent, participantId: string): Promise<Result> {
  if (event.status !== "launched") return fail("Le tirage n'a pas encore eu lieu.");
  const [p] = await db
    .select()
    .from(santaParticipant)
    .where(and(eq(santaParticipant.id, participantId), eq(santaParticipant.eventId, event.id)))
    .limit(1);
  if (!p) return fail("Participant introuvable.");
  await sendInvite(event, p, await organizerName(event));
  return { ok: true };
}

/** Undoes the draw, to change the list or the rules. Links stay the same; a new launch draws again and mails everyone again. */
export async function backToPreparation(event: SantaEvent): Promise<Result> {
  if (event.status !== "launched") return fail("Déjà en préparation.");
  await db.transaction(async (tx) => {
    await tx.delete(santaQuestion).where(eq(santaQuestion.eventId, event.id));
    await tx.delete(santaUnmask).where(eq(santaUnmask.eventId, event.id));
    await tx
      .update(santaParticipant)
      .set({ recipientId: null, mailSentAt: null, mailError: null, revealedAt: null, letterNotifiedAt: null })
      .where(eq(santaParticipant.eventId, event.id));
    await tx.update(santaEvent).set({ status: "preparation", launchedAt: null, archivedAt: null }).where(eq(santaEvent.id, event.id));
  });
  return { ok: true };
}

/** The break-glass: an organizer looks at who a participant drew. It leaves a trace the other organizers see. */
export async function unmaskParticipant(event: SantaEvent, participantId: string, memberId: string): Promise<{ ok: true; recipient: string } | { ok: false; error: string }> {
  const participants = await loadParticipants(event.id);
  const p = participants.find((x) => x.id === participantId);
  const recipient = participants.find((x) => x.id === p?.recipientId);
  if (!p || !recipient) return fail("Pas de tirage à démasquer.");
  await db.insert(santaUnmask).values({ eventId: event.id, memberId, participantId });
  return { ok: true, recipient: recipient.name };
}

// ───────── After Christmas ─────────

export async function setArchived(event: SantaEvent, archived: boolean): Promise<Result> {
  if (archived && event.status !== "launched") return fail("Seul un Secret Santa lancé peut être archivé.");
  await db
    .update(santaEvent)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(santaEvent.id, event.id));
  return { ok: true };
}

/** The whole draw, for an archived event whose organizers ask to unmask it. */
export async function archivedDraw(event: SantaEvent): Promise<{ giver: string; recipient: string }[]> {
  if (!event.archivedAt) return [];
  const participants = await loadParticipants(event.id);
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  return participants.map((p) => ({ giver: p.name, recipient: (p.recipientId && nameOf.get(p.recipientId)) || "?" }));
}

/** Next year's event: same people, same rules, same organization, same look, and last year's draw to avoid. */
export async function redoNextYear(event: SantaEvent, memberId: string): Promise<SantaEvent> {
  const next = await createEvent(memberId, nextYearTitle(event.title, new Date().getFullYear()).slice(0, LIMITS.title));
  await db.update(santaEvent).set({ budget: event.budget, message: event.message, theme: event.theme, cohostPassword: event.cohostPassword, previousEventId: event.id }).where(eq(santaEvent.id, next.id));
  const participants = await loadParticipants(event.id);
  const newIds = new Map<string, string>();
  for (const p of participants) {
    const [copy] = await db
      .insert(santaParticipant)
      .values({ eventId: next.id, memberId: p.memberId, name: p.name, email: p.email, token: newToken() })
      .returning({ id: santaParticipant.id });
    if (copy) newIds.set(p.id, copy.id);
  }
  for (const r of await loadRules(event.id)) {
    const fromId = newIds.get(r.fromId);
    const toId = newIds.get(r.toId);
    if (fromId && toId) await db.insert(santaExclusion).values({ eventId: next.id, fromId, toId, mutual: r.mutual });
  }
  const cohosts = await db.select({ memberId: santaCohost.memberId }).from(santaCohost).where(eq(santaCohost.eventId, event.id));
  const team = [...cohosts.map((c) => c.memberId), event.hostMemberId].filter((id) => id !== memberId);
  for (const id of team) await db.insert(santaCohost).values({ eventId: next.id, memberId: id }).onConflictDoNothing();
  return next;
}

export async function deleteEvent(event: SantaEvent): Promise<void> {
  await db.delete(santaEvent).where(eq(santaEvent.id, event.id));
}

// ───────── A participant's personal page ─────────

async function findByToken(token: string) {
  const [row] = await db
    .select({ me: santaParticipant, event: santaEvent })
    .from(santaParticipant)
    .innerJoin(santaEvent, eq(santaEvent.id, santaParticipant.eventId))
    .where(eq(santaParticipant.token, token))
    .limit(1);
  return row ?? null;
}

export async function getMeView(token: string): Promise<MeView | null> {
  const found = await findByToken(token);
  if (!found) return null;
  const { me, event } = found;
  const launched = event.status === "launched";
  const revealed = launched && !!me.revealedAt;
  const [recipient] = revealed && me.recipientId ? await db.select().from(santaParticipant).where(eq(santaParticipant.id, me.recipientId)).limit(1) : [];
  const questions = launched
    ? await db
        .select()
        .from(santaQuestion)
        .where(and(eq(santaQuestion.eventId, event.id), or(eq(santaQuestion.askerId, me.id), eq(santaQuestion.targetId, me.id))))
        .orderBy(asc(santaQuestion.createdAt))
    : [];
  const view = (q: (typeof questions)[number]) => ({ id: q.id, question: q.question, answer: q.answer });
  return {
    title: event.title,
    organizer: await organizerName(event),
    budget: event.budget,
    exchangeDate: event.exchangeDate,
    message: event.message,
    theme: asTheme(event.theme),
    status: event.status as SantaStatus,
    archived: !!event.archivedAt,
    name: me.name,
    letter: me.letter,
    revealed,
    recipient: recipient ? { name: recipient.name, letter: recipient.letter } : null,
    asked: questions.filter((q) => q.askerId === me.id).map(view),
    toAnswer: questions.filter((q) => q.targetId === me.id).map(view),
  };
}

/** For the notes between Santa and the person they drew: never fails the action that triggers it, and never names anyone. */
async function notify(event: SantaEvent, to: SantaParticipant, heading: string, body: string, cta: string): Promise<void> {
  try {
    const address = await addressOf(to);
    if (!address) return;
    const link = personalLink(to.token);
    await sendMail({
      to: address,
      subject: `🎁 ${heading}`,
      react: SantaNoticeEmail({ title: event.title, heading, body, link, cta, theme: asTheme(event.theme) }),
      devFallbackMessage: `Secret Santa notice for ${address} (${heading}):\n${link}`,
    });
  } catch (error) {
    console.error("Secret Santa: notice not sent", error);
  }
}

const open = (event: SantaEvent) => (event.status === "launched" && !event.archivedAt ? null : fail("Ce Secret Santa n'est plus ouvert."));

export async function revealGift(token: string): Promise<Result> {
  const found = await findByToken(token);
  if (!found || found.event.status !== "launched") return fail("Le tirage n'a pas encore eu lieu.");
  if (!found.me.revealedAt) await db.update(santaParticipant).set({ revealedAt: new Date() }).where(eq(santaParticipant.id, found.me.id));
  return { ok: true };
}

export async function saveLetter(token: string, letter: string): Promise<Result> {
  const found = await findByToken(token);
  if (!found) return fail("Lien inconnu.");
  const closed = open(found.event);
  if (closed) return closed;
  const text = letter.trim();
  const first = !!text && !found.me.letterNotifiedAt;
  await db
    .update(santaParticipant)
    .set({ letter: text, ...(first ? { letterNotifiedAt: new Date() } : {}) })
    .where(eq(santaParticipant.id, found.me.id));
  if (first) {
    const [santa] = await db.select().from(santaParticipant).where(eq(santaParticipant.recipientId, found.me.id)).limit(1);
    if (santa) {
      await notify(found.event, santa, "Une lettre au Père Noël est arrivée", "La personne que tu gâtes vient d'écrire sa lettre au Père Noël. Personne d'autre que toi ne peut la lire.", "Lire sa lettre");
    }
  }
  return { ok: true };
}

export async function askQuestion(token: string, question: string): Promise<Result> {
  const found = await findByToken(token);
  if (!found) return fail("Lien inconnu.");
  const closed = open(found.event);
  if (closed) return closed;
  const { me, event } = found;
  if (!me.recipientId || !me.revealedAt) return fail("Ouvre d'abord ton cadeau.");
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(santaQuestion).where(eq(santaQuestion.askerId, me.id));
  if ((count?.n ?? 0) >= LIMITS.questionsPerGiver) return fail(`${LIMITS.questionsPerGiver} questions au plus : le Père Noël doit garder un peu de mystère.`);
  await db.insert(santaQuestion).values({ eventId: event.id, askerId: me.id, targetId: me.recipientId, question: question.trim() });
  const [target] = await db.select().from(santaParticipant).where(eq(santaParticipant.id, me.recipientId)).limit(1);
  if (target) await notify(event, target, "Ton Père Noël secret a une question", "Quelqu'un qui te prépare un cadeau te pose une question, sans se dévoiler. À toi de répondre !", "Voir la question");
  return { ok: true };
}

export async function answerQuestion(token: string, questionId: string, answer: string): Promise<Result> {
  const found = await findByToken(token);
  if (!found) return fail("Lien inconnu.");
  const closed = open(found.event);
  if (closed) return closed;
  const { me, event } = found;
  const [updated] = await db
    .update(santaQuestion)
    .set({ answer: answer.trim(), answeredAt: new Date() })
    .where(and(eq(santaQuestion.id, questionId), eq(santaQuestion.targetId, me.id)))
    .returning({ askerId: santaQuestion.askerId });
  if (!updated) return fail("Question introuvable.");
  const [asker] = await db.select().from(santaParticipant).where(eq(santaParticipant.id, updated.askerId)).limit(1);
  if (asker) await notify(event, asker, "On a répondu à ta question", "La personne que tu gâtes a répondu à ta question.", "Lire la réponse");
  return { ok: true };
}

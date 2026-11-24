import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/core/db/client";
import { birthday, birthdayIdea, birthdayParticipant, birthdayVote, member, user, type Birthday } from "@/core/db/schema";
import { sendMail } from "@/core/mail/send";
import { BirthdayEmail } from "@/core/mail/templates/BirthdayEmail";
import { createNotification } from "@/core/notifications";
import { wantsEmail } from "@/core/notifications/preferences";
import { sharesFor } from "./split";

/*
 * The one rule of this module: the person celebrated never sees anything. Every read goes through
 * `visibleBirthday` (participant, and not the honoree), every notification goes to participants
 * only, nothing is written to the club's activity feed, and admin mode opens no door here.
 */

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
export const birthdayPath = (id: string) => `/celebrer/anniversaires/${id}`;

export type Answer = "pending" | "yes" | "no";

/** The birthday, if this member may see it: they take part, and it isn't theirs. */
async function visibleBirthday(id: string, memberId: string): Promise<Birthday | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ b: birthday })
    .from(birthday)
    .innerJoin(birthdayParticipant, and(eq(birthdayParticipant.birthdayId, birthday.id), eq(birthdayParticipant.memberId, memberId)))
    .where(eq(birthday.id, id));
  if (!row || row.b.honoreeMemberId === memberId) return null;
  return row.b;
}

/** The members one can invite or celebrate: everyone, with their name. */
export async function listClubMembers() {
  return db.select({ id: member.id, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name));
}

/** The birthdays this member is in on (never the ones about them), soonest first. */
export async function listForMember(memberId: string) {
  const rows = await db
    .select({ b: birthday, answer: birthdayParticipant.answer })
    .from(birthday)
    .innerJoin(birthdayParticipant, and(eq(birthdayParticipant.birthdayId, birthday.id), eq(birthdayParticipant.memberId, memberId)))
    .orderBy(asc(birthday.eventDate));
  return rows
    .filter((r) => r.b.honoreeMemberId !== memberId)
    .map((r) => ({ id: r.b.id, name: r.b.honoreeName, date: r.b.eventDate, answer: r.answer as Answer, mine: r.b.createdById === memberId, bought: !!r.b.boughtAt }));
}

async function notifyParticipants(b: Birthday, memberIds: string[], kind: string, heading: string, lines: string[], cta: string) {
  const ids = memberIds.filter((id) => id !== b.honoreeMemberId);
  if (!ids.length) return;
  const people = await db.select({ id: member.id, email: user.email, prefs: member.notifPrefs }).from(member).innerJoin(user, eq(user.id, member.userId)).where(inArray(member.id, ids));
  for (const p of people) {
    try {
      await createNotification({ memberId: p.id, kind, entityRef: `birthday:${b.id}`, payload: { birthdayId: b.id, name: b.honoreeName, text: heading } });
      if (p.email && wantsEmail(p.prefs, "anniversaire")) {
        await sendMail({ to: p.email, subject: `🎂 ${heading}`, react: BirthdayEmail({ heading, lines, link: `${appUrl()}${birthdayPath(b.id)}`, cta }), devFallbackMessage: `${p.email}: ${heading}` });
      }
    } catch (error) {
      console.error("Birthday notification failed", error);
    }
  }
}

/** « mardi 12 mars 2030 ». */
export const longDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export async function createBirthday(input: {
  creatorId: string;
  creatorName: string;
  honoreeMemberId: string | null;
  honoreeName: string;
  eventDate: string;
  note: string;
  inviteeIds: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (input.honoreeMemberId === input.creatorId) return { ok: false, error: "On ne s'organise pas son propre anniversaire ici : demande à quelqu'un d'autre !" };
  const invitees = [...new Set(input.inviteeIds)].filter((id) => id !== input.creatorId && id !== input.honoreeMemberId);
  const [b] = await db
    .insert(birthday)
    .values({ createdById: input.creatorId, honoreeMemberId: input.honoreeMemberId, honoreeName: input.honoreeName, eventDate: input.eventDate, note: input.note })
    .returning();
  if (!b) return { ok: false, error: "L'anniversaire n'a pas pu être créé." };
  await db.insert(birthdayParticipant).values([
    { birthdayId: b.id, memberId: input.creatorId, answer: "yes", invitedById: input.creatorId },
    ...invitees.map((memberId) => ({ birthdayId: b.id, memberId, invitedById: input.creatorId })),
  ]);
  await notifyParticipants(
    b,
    invitees,
    "birthday.invited",
    `${input.creatorName} prépare l'anniversaire de ${b.honoreeName}`,
    [`C'est le ${frDate(b.eventDate)}.`, "Propose des idées de cadeau, mets un pouce à celles qui te plaisent, et dis si tu participes."],
    "Voir les idées",
  );
  return { ok: true, id: b.id };
}

export interface BirthdayView {
  id: string;
  name: string;
  honoreeIsMember: boolean;
  date: string;
  note: string;
  isCreator: boolean;
  creatorName: string;
  me: { id: string; answer: Answer; repaid: boolean };
  participants: { id: string; name: string; answer: Answer; repaid: boolean; isCreator: boolean }[];
  ideas: { id: string; title: string; url: string | null; priceCents: number | null; note: string; authorName: string; mine: boolean; votes: number; votedByMe: boolean; voters: string[] }[];
  chosenIdeaId: string | null;
  buyer: { id: string; name: string } | null;
  priceCents: number | null;
  bought: boolean;
  shares: { memberId: string; name: string; cents: number; owesBuyer: boolean; repaid: boolean }[];
  /** Members not in it yet, who can be invited (never the honoree). */
  invitable: { id: string; name: string }[];
}

export async function getBirthdayView(id: string, memberId: string): Promise<BirthdayView | null> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return null;
  const [people, ideas, votes, everyone] = await Promise.all([
    db
      .select({ id: member.id, name: user.name, answer: birthdayParticipant.answer, repaidAt: birthdayParticipant.repaidAt, createdAt: birthdayParticipant.createdAt })
      .from(birthdayParticipant)
      .innerJoin(member, eq(member.id, birthdayParticipant.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(birthdayParticipant.birthdayId, b.id))
      .orderBy(asc(birthdayParticipant.createdAt)),
    db
      .select({ idea: birthdayIdea, authorName: user.name })
      .from(birthdayIdea)
      .innerJoin(member, eq(member.id, birthdayIdea.authorId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(birthdayIdea.birthdayId, b.id))
      .orderBy(asc(birthdayIdea.createdAt)),
    db
      .select({ ideaId: birthdayVote.ideaId, memberId: birthdayVote.memberId, name: user.name })
      .from(birthdayVote)
      .innerJoin(birthdayIdea, eq(birthdayIdea.id, birthdayVote.ideaId))
      .innerJoin(member, eq(member.id, birthdayVote.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(birthdayIdea.birthdayId, b.id)),
    listClubMembers(),
  ]);
  const nameOf = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? everyone.find((m) => m.id === id)?.name ?? "Un membre") : "");
  const meRow = people.find((p) => p.id === memberId)!;
  const payers = people.filter((p) => p.answer === "yes").map((p) => p.id);
  const shares = b.priceCents
    ? sharesFor(b.priceCents, payers, b.buyerMemberId).map((s) => ({ ...s, name: nameOf(s.memberId), repaid: !!people.find((p) => p.id === s.memberId)?.repaidAt }))
    : [];
  const inIt = new Set(people.map((p) => p.id));
  return {
    id: b.id,
    name: b.honoreeName,
    honoreeIsMember: !!b.honoreeMemberId,
    date: b.eventDate,
    note: b.note,
    isCreator: b.createdById === memberId,
    creatorName: nameOf(b.createdById),
    me: { id: memberId, answer: meRow.answer as Answer, repaid: !!meRow.repaidAt },
    participants: people.map((p) => ({ id: p.id, name: p.name, answer: p.answer as Answer, repaid: !!p.repaidAt, isCreator: p.id === b.createdById })),
    ideas: ideas
      .map(({ idea, authorName }) => {
        const v = votes.filter((x) => x.ideaId === idea.id);
        return { id: idea.id, title: idea.title, url: idea.url, priceCents: idea.priceCents, note: idea.note, authorName, mine: idea.authorId === memberId, votes: v.length, votedByMe: v.some((x) => x.memberId === memberId), voters: v.map((x) => x.name) };
      })
      .sort((a, b2) => b2.votes - a.votes),
    chosenIdeaId: b.chosenIdeaId,
    buyer: b.buyerMemberId ? { id: b.buyerMemberId, name: nameOf(b.buyerMemberId) } : null,
    priceCents: b.priceCents,
    bought: !!b.boughtAt,
    shares,
    invitable: everyone.filter((m) => !inIt.has(m.id) && m.id !== b.honoreeMemberId),
  };
}

type Result = { ok: true } | { ok: false; error: string };
const NOT_FOUND: Result = { ok: false, error: "Cet anniversaire n'existe pas, ou tu n'y participes pas." };

export async function inviteMore(id: string, actorId: string, actorName: string, memberIds: string[]): Promise<Result> {
  const b = await visibleBirthday(id, actorId);
  if (!b) return NOT_FOUND;
  const already = new Set((await db.select({ id: birthdayParticipant.memberId }).from(birthdayParticipant).where(eq(birthdayParticipant.birthdayId, b.id))).map((r) => r.id));
  const fresh = [...new Set(memberIds)].filter((m) => !already.has(m) && m !== b.honoreeMemberId);
  if (!fresh.length) return { ok: false, error: "Choisis au moins une personne à inviter." };
  await db.insert(birthdayParticipant).values(fresh.map((memberId) => ({ birthdayId: b.id, memberId, invitedById: actorId })));
  await notifyParticipants(
    b,
    fresh,
    "birthday.invited",
    `${actorName} t'invite pour l'anniversaire de ${b.honoreeName}`,
    [`C'est le ${frDate(b.eventDate)}.`, "Propose des idées de cadeau, mets un pouce à celles qui te plaisent, et dis si tu participes."],
    "Voir les idées",
  );
  return { ok: true };
}

export async function answer(id: string, memberId: string, value: "yes" | "no"): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  if (value === "no" && b.buyerMemberId === memberId) return { ok: false, error: "Tu t'occupes de l'achat : passe d'abord la main." };
  await db.update(birthdayParticipant).set({ answer: value }).where(and(eq(birthdayParticipant.birthdayId, b.id), eq(birthdayParticipant.memberId, memberId)));
  return { ok: true };
}

export async function addIdea(id: string, memberId: string, idea: { title: string; url: string | null; priceCents: number | null; note: string }): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  const [row] = await db.insert(birthdayIdea).values({ birthdayId: b.id, authorId: memberId, ...idea }).returning({ id: birthdayIdea.id });
  // Who proposes an idea likes it.
  if (row) await db.insert(birthdayVote).values({ ideaId: row.id, memberId }).onConflictDoNothing();
  return { ok: true };
}

export async function removeIdea(id: string, memberId: string, ideaId: string): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  const [idea] = await db.select().from(birthdayIdea).where(and(eq(birthdayIdea.id, ideaId), eq(birthdayIdea.birthdayId, b.id)));
  if (!idea) return { ok: false, error: "Cette idée n'existe plus." };
  if (idea.authorId !== memberId && b.createdById !== memberId) return { ok: false, error: "Seuls son auteur et l'organisateur peuvent retirer une idée." };
  if (b.chosenIdeaId === ideaId) return { ok: false, error: "C'est l'idée retenue : reviens d'abord au choix." };
  await db.delete(birthdayIdea).where(eq(birthdayIdea.id, ideaId));
  return { ok: true };
}

export async function toggleVote(id: string, memberId: string, ideaId: string): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  const [idea] = await db.select({ id: birthdayIdea.id }).from(birthdayIdea).where(and(eq(birthdayIdea.id, ideaId), eq(birthdayIdea.birthdayId, b.id)));
  if (!idea) return { ok: false, error: "Cette idée n'existe plus." };
  const deleted = await db.delete(birthdayVote).where(and(eq(birthdayVote.ideaId, ideaId), eq(birthdayVote.memberId, memberId))).returning();
  if (!deleted.length) await db.insert(birthdayVote).values({ ideaId, memberId });
  return { ok: true };
}

/** The organiser decides (or goes back to the ideas with `null`). */
export async function choose(id: string, memberId: string, ideaId: string | null): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  if (b.createdById !== memberId) return { ok: false, error: "C'est l'organisateur qui tranche." };
  if (b.boughtAt) return { ok: false, error: "Le cadeau est déjà acheté." };
  let title = "";
  if (ideaId) {
    const [idea] = await db.select({ title: birthdayIdea.title }).from(birthdayIdea).where(and(eq(birthdayIdea.id, ideaId), eq(birthdayIdea.birthdayId, b.id)));
    if (!idea) return { ok: false, error: "Cette idée n'existe plus." };
    title = idea.title;
  }
  await db.update(birthday).set({ chosenIdeaId: ideaId, ...(ideaId ? {} : { buyerMemberId: null }) }).where(eq(birthday.id, b.id));
  if (ideaId) {
    const others = (await db.select({ id: birthdayParticipant.memberId }).from(birthdayParticipant).where(and(eq(birthdayParticipant.birthdayId, b.id), ne(birthdayParticipant.memberId, memberId)))).map((r) => r.id);
    await notifyParticipants(b, others, "birthday.chosen", `Anniversaire de ${b.honoreeName} : ce sera « ${title} »`, ["Il reste à trouver qui s'occupe de l'achat, et à dire si tu participes."], "Voir l'anniversaire");
  }
  return { ok: true };
}

/** « Je m'en charge »: the buyer takes part, of course. `false` hands it back. */
export async function takeCharge(id: string, memberId: string, take: boolean): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  if (!b.chosenIdeaId) return { ok: false, error: "Le cadeau n'est pas encore choisi." };
  if (b.boughtAt) return { ok: false, error: "Le cadeau est déjà acheté." };
  if (take) {
    if (b.buyerMemberId && b.buyerMemberId !== memberId) return { ok: false, error: "Quelqu'un s'en charge déjà." };
    await db.update(birthday).set({ buyerMemberId: memberId }).where(eq(birthday.id, b.id));
    await db.update(birthdayParticipant).set({ answer: "yes" }).where(and(eq(birthdayParticipant.birthdayId, b.id), eq(birthdayParticipant.memberId, memberId)));
  } else if (b.buyerMemberId === memberId) {
    await db.update(birthday).set({ buyerMemberId: null }).where(eq(birthday.id, b.id));
  }
  return { ok: true };
}

/** The buyer enters what it really cost: the parts appear for everyone. `null` undoes it. */
export async function setPrice(id: string, memberId: string, priceCents: number | null): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  if (b.buyerMemberId !== memberId) return { ok: false, error: "C'est celui qui achète qui note le prix." };
  await db.update(birthday).set({ priceCents, boughtAt: priceCents ? new Date() : null }).where(eq(birthday.id, b.id));
  if (priceCents && !b.boughtAt) {
    const payers = (await db.select({ id: birthdayParticipant.memberId }).from(birthdayParticipant).where(and(eq(birthdayParticipant.birthdayId, b.id), eq(birthdayParticipant.answer, "yes")))).map((r) => r.id);
    const buyerName = (await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, memberId)))[0]?.name ?? "L'acheteur";
    await notifyParticipants(b, payers.filter((p) => p !== memberId), "birthday.bought", `Le cadeau de ${b.honoreeName} est acheté`, [`${buyerName} l'a payé : ta part t'attend sur la page, avec à qui la rembourser.`], "Voir ma part");
  }
  return { ok: true };
}

/** « J'ai remboursé » by the payer, or « reçu » by the buyer. */
export async function markRepaid(id: string, actorId: string, payerId: string, repaid: boolean): Promise<Result> {
  const b = await visibleBirthday(id, actorId);
  if (!b) return NOT_FOUND;
  if (actorId !== payerId && actorId !== b.buyerMemberId) return { ok: false, error: "Seuls la personne et l'acheteur peuvent cocher ce remboursement." };
  await db.update(birthdayParticipant).set({ repaidAt: repaid ? new Date() : null }).where(and(eq(birthdayParticipant.birthdayId, b.id), eq(birthdayParticipant.memberId, payerId)));
  return { ok: true };
}

export async function deleteBirthday(id: string, memberId: string): Promise<Result> {
  const b = await visibleBirthday(id, memberId);
  if (!b) return NOT_FOUND;
  if (b.createdById !== memberId) return { ok: false, error: "Seul l'organisateur peut supprimer l'anniversaire." };
  await db.delete(birthday).where(eq(birthday.id, b.id));
  return { ok: true };
}


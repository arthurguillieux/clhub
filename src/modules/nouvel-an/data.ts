import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import {
  member,
  nyeCohost,
  nyeCost,
  nyeEdition,
  nyeExpense,
  nyeGuest,
  nyeItem,
  nyeList,
  nyeMeal,
  nyeOption,
  nyeTask,
  nyeTaskGuest,
  user,
  type NyeEdition,
  type NyeGuest,
} from "@/core/db/schema";
import { euros } from "@/core/money";
import { sendMail } from "@/core/mail/send";
import { NyeEmail } from "@/core/mail/templates/NyeEmail";
import { createNotification } from "@/core/notifications";
import { wantsEmail } from "@/core/notifications/preferences";
import { budget, eventDays, headcount, itemNeed, type Answer, type Budget, type Headcount, type ItemNeed, type Rule, type Split } from "./domain/plan";
import { TEMPLATE_COSTS, TEMPLATE_LISTS, TEMPLATE_TASKS, templateMeals } from "./domain/template";

/*
 * « Nouvel an »: the organizers (the creator and their co-organizers) change everything; a guest —
 * a member, or anyone through their personal link — answers, takes on a mission, notes what they
 * advanced, says « j'ai payé ». Nothing goes to the club's activity feed: it's a private party.
 */

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const OK: Result = { ok: true };

export const LIMITS = { guests: 80, title: 80, name: 60, text: 2000, short: 200 };
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const newToken = () => randomBytes(24).toString("base64url");
export const editionPath = (code: string) => `/celebrer/nouvel-an/${code}`;
export const guestLink = (token: string) => `${appUrl()}/nouvel-an/${token}`;
const longDate = (d: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${d}T12:00:00Z`));
/** « du mercredi 31 décembre au jeudi 1er janvier ». */
export const span = (from: string, to: string) => (from === to ? `le ${longDate(from)}` : `du ${longDate(from)} au ${longDate(to)}`).replace(/ 1 /g, " 1er ");

// ───────── Finding an edition, and who may do what ─────────

export async function getEditionByCode(code: string): Promise<NyeEdition | null> {
  if (!/^[A-Z0-9]{6}$/i.test(code)) return null;
  const [e] = await db.select().from(nyeEdition).where(eq(nyeEdition.code, code.toUpperCase())).limit(1);
  return e ?? null;
}

export async function isOrganizer(e: NyeEdition, memberId: string): Promise<boolean> {
  if (e.hostMemberId === memberId) return true;
  const [row] = await db
    .select({ id: nyeCohost.memberId })
    .from(nyeCohost)
    .where(and(eq(nyeCohost.editionId, e.id), eq(nyeCohost.memberId, memberId)))
    .limit(1);
  return !!row;
}

export async function guestOfMember(e: NyeEdition, memberId: string): Promise<NyeGuest | null> {
  const [g] = await db
    .select()
    .from(nyeGuest)
    .where(and(eq(nyeGuest.editionId, e.id), eq(nyeGuest.memberId, memberId)))
    .limit(1);
  return g ?? null;
}

export async function findByToken(token: string): Promise<{ guest: NyeGuest; edition: NyeEdition } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select({ guest: nyeGuest, edition: nyeEdition }).from(nyeGuest).innerJoin(nyeEdition, eq(nyeEdition.id, nyeGuest.editionId)).where(eq(nyeGuest.token, token)).limit(1);
  return row ?? null;
}

/** Célébrer › Nouvel an: the editions I organize, and those I'm invited to. */
export async function listForMember(memberId: string) {
  const cohosted = db.select({ id: nyeCohost.editionId }).from(nyeCohost).where(eq(nyeCohost.memberId, memberId));
  const invited = db.select({ id: nyeGuest.editionId }).from(nyeGuest).where(eq(nyeGuest.memberId, memberId));
  const rows = await db
    .select()
    .from(nyeEdition)
    .where(or(eq(nyeEdition.hostMemberId, memberId), inArray(nyeEdition.id, cohosted), inArray(nyeEdition.id, invited)))
    .orderBy(desc(nyeEdition.startsOn));
  const mine = new Set((await db.select({ id: nyeCohost.editionId }).from(nyeCohost).where(eq(nyeCohost.memberId, memberId))).map((r) => r.id));
  return rows.map((e) => ({ code: e.code, title: e.title, startsOn: e.startsOn, endsOn: e.endsOn, place: e.place, organizer: e.hostMemberId === memberId || mine.has(e.id) }));
}

export async function listClubMembers() {
  return db.select({ id: member.id, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name));
}

// ───────── Creating an edition ─────────

async function newCode(): Promise<string> {
  for (;;) {
    const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: nyeEdition.id }).from(nyeEdition).where(eq(nyeEdition.code, code)).limit(1);
    if (!taken) return code;
  }
}

const shiftDay = (d: string, days: number) => new Date(Date.parse(`${d}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * A new edition: from scratch (the old spreadsheet's lists, missions and meals), or from a previous
 * one (its guests, options, missions, lists, costs and organizers; answers, payments, assignments and
 * expenses start afresh). The creator is a guest who said yes.
 */
export async function createEdition(input: { hostId: string; title: string; startsOn: string; endsOn: string; fromCode: string | null }): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (input.endsOn < input.startsOn) return fail("La fin ne peut pas être avant le début.");
  if (eventDays(input.startsOn, input.endsOn).length > 14) return fail("Deux semaines au plus.");
  const from = input.fromCode ? await getEditionByCode(input.fromCode) : null;
  if (input.fromCode && (!from || !(await isOrganizer(from, input.hostId)))) return fail("Cette édition n'est pas à toi.");
  const [host] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, input.hostId)).limit(1);
  const code = await newCode();
  const [e] = await db
    .insert(nyeEdition)
    .values({ code, hostMemberId: input.hostId, title: input.title, startsOn: input.startsOn, endsOn: input.endsOn, place: from?.place ?? "", message: from?.message ?? "", paymentInfo: from?.paymentInfo ?? "", previousEditionId: from?.id ?? null })
    .returning();
  if (!e) return fail("L'édition n'a pas pu être créée.");

  if (!from) {
    await db.insert(nyeGuest).values({ editionId: e.id, memberId: input.hostId, name: host?.name ?? "Moi", token: newToken(), answer: "yes" });
    const meals = templateMeals(e.startsOn, e.endsOn);
    if (meals.length) await db.insert(nyeMeal).values(meals.map((m, n) => ({ editionId: e.id, day: m.day, label: m.label, sort: n })));
    await db.insert(nyeTask).values(TEMPLATE_TASKS.map((t, n) => ({ editionId: e.id, pole: t.pole, title: t.title, due: t.due, sort: n })));
    await db.insert(nyeCost).values(TEMPLATE_COSTS.map((c, n) => ({ editionId: e.id, label: c.label, split: c.split, sort: n })));
    for (const [n, l] of TEMPLATE_LISTS.entries()) {
      const [list] = await db.insert(nyeList).values({ editionId: e.id, name: l.name, split: l.split, sort: n }).returning();
      if (list) await db.insert(nyeItem).values(l.items.map((it, k) => ({ listId: list.id, ...it, sort: k })));
    }
    return { ok: true, code };
  }

  // From last year: the same people and the same habits, a year later.
  const shift = Math.round((Date.parse(`${e.startsOn}T12:00:00Z`) - Date.parse(`${from.startsOn}T12:00:00Z`)) / 86_400_000);
  const optionIds = new Map<string, string>();
  for (const o of await db.select().from(nyeOption).where(eq(nyeOption.editionId, from.id)).orderBy(asc(nyeOption.sort))) {
    const [copy] = await db.insert(nyeOption).values({ editionId: e.id, label: o.label, priceCents: o.priceCents, sort: o.sort }).returning({ id: nyeOption.id });
    if (copy) optionIds.set(o.id, copy.id);
  }
  const oldGuests = await db.select().from(nyeGuest).where(eq(nyeGuest.editionId, from.id)).orderBy(asc(nyeGuest.createdAt));
  const guests = oldGuests.some((g) => g.memberId === input.hostId) ? oldGuests : [{ memberId: input.hostId, name: host?.name ?? "Moi", email: null, optionId: null, diet: "" } as Pick<NyeGuest, "memberId" | "name" | "email" | "optionId" | "diet">, ...oldGuests];
  if (guests.length)
    await db.insert(nyeGuest).values(
      guests.map((g) => ({
        editionId: e.id,
        memberId: g.memberId,
        name: g.name,
        email: g.email,
        token: newToken(),
        answer: g.memberId === input.hostId ? "yes" : "pending",
        optionId: g.optionId ? (optionIds.get(g.optionId) ?? null) : null,
        diet: g.diet,
      })),
    );
  const meals = await db.select().from(nyeMeal).where(eq(nyeMeal.editionId, from.id)).orderBy(asc(nyeMeal.sort));
  const days = eventDays(e.startsOn, e.endsOn);
  const kept = meals.map((m) => ({ ...m, day: shiftDay(m.day, shift) })).filter((m) => days.includes(m.day));
  const newMeals = kept.length ? kept : templateMeals(e.startsOn, e.endsOn).map((m, n) => ({ ...m, menu: "", sort: n }));
  if (newMeals.length) await db.insert(nyeMeal).values(newMeals.map((m) => ({ editionId: e.id, day: m.day, label: m.label, menu: m.menu, sort: m.sort })));
  const tasks = await db.select().from(nyeTask).where(eq(nyeTask.editionId, from.id)).orderBy(asc(nyeTask.sort));
  if (tasks.length) await db.insert(nyeTask).values(tasks.map((t) => ({ editionId: e.id, pole: t.pole, title: t.title, due: t.due, note: t.note, sort: t.sort })));
  const costs = await db.select().from(nyeCost).where(eq(nyeCost.editionId, from.id)).orderBy(asc(nyeCost.sort));
  if (costs.length) await db.insert(nyeCost).values(costs.map((c) => ({ editionId: e.id, label: c.label, cents: c.cents, split: c.split, sort: c.sort })));
  for (const l of await db.select().from(nyeList).where(eq(nyeList.editionId, from.id)).orderBy(asc(nyeList.sort))) {
    const [list] = await db.insert(nyeList).values({ editionId: e.id, name: l.name, split: l.split, sort: l.sort }).returning();
    const items = await db.select().from(nyeItem).where(eq(nyeItem.listId, l.id)).orderBy(asc(nyeItem.sort));
    if (list && items.length)
      await db.insert(nyeItem).values(items.map((it) => ({ listId: list.id, name: it.name, rule: it.rule, ratio: it.ratio, unit: it.unit, perPack: it.perPack, packPriceCents: it.packPriceCents, sort: it.sort })));
  }
  const team = (await db.select({ id: nyeCohost.memberId }).from(nyeCohost).where(eq(nyeCohost.editionId, from.id))).map((c) => c.id);
  for (const id of [...team, from.hostMemberId].filter((id) => id !== input.hostId)) await db.insert(nyeCohost).values({ editionId: e.id, memberId: id }).onConflictDoNothing();
  return { ok: true, code };
}

export async function deleteEdition(e: NyeEdition): Promise<void> {
  await db.delete(nyeEdition).where(eq(nyeEdition.id, e.id));
}

// ───────── The views ─────────

export interface GuestRow {
  id: string;
  name: string;
  isMember: boolean;
  answer: Answer;
  days: string[] | null;
  optionId: string | null;
  diet: string;
  note: string;
  /** Organizers only. */
  email: string | null;
  token: string | null;
  invited: boolean;
  mailError: string | null;
  paidDeclared: boolean;
  receivedCents: number;
  reminded: string | null;
}

export interface ItemRow {
  id: string;
  name: string;
  rule: Rule;
  ratio: number;
  unit: string;
  perPack: number;
  packPriceCents: number | null;
  stock: number;
  overridePacks: number | null;
  guestId: string | null;
  bought: boolean;
  need: ItemNeed;
}

export interface EditionView {
  code: string;
  title: string;
  startsOn: string;
  endsOn: string;
  span: string;
  days: string[];
  place: string;
  message: string;
  paymentInfo: string;
  headcountOverride: number | null;
  requestSentAt: string | null;
  organizer: boolean;
  isHost: boolean;
  hostName: string;
  cohosts: { memberId: string; name: string }[];
  options: { id: string; label: string; priceCents: number }[];
  guests: GuestRow[];
  meals: { id: string; day: string; label: string; menu: string }[];
  tasks: { id: string; pole: string; title: string; due: string; status: "todo" | "doing" | "done"; note: string; guestIds: string[] }[];
  lists: { id: string; name: string; split: Split; items: ItemRow[]; totalCents: number }[];
  costs: { id: string; label: string; cents: number; split: Split }[];
  expenses: { id: string; guestId: string; label: string; cents: number; lineKey: string | null; at: string }[];
  headcount: Headcount;
  budget: Budget;
  /** The guest whose page this is (for a guest), with their token for their own actions. */
  me: { guestId: string; token: string } | null;
  /** Organizers: members not invited yet; and which member each member guest is. */
  invitable: { id: string; name: string }[];
  memberIds: Record<string, string>;
}

export async function buildView(e: NyeEdition, viewer: { organizer: boolean; memberId: string | null; guest: NyeGuest | null }): Promise<EditionView> {
  const [host] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, e.hostMemberId)).limit(1);
  const cohosts = await db.select({ memberId: nyeCohost.memberId, name: user.name }).from(nyeCohost).innerJoin(member, eq(member.id, nyeCohost.memberId)).innerJoin(user, eq(user.id, member.userId)).where(eq(nyeCohost.editionId, e.id));
  const options = await db.select().from(nyeOption).where(eq(nyeOption.editionId, e.id)).orderBy(asc(nyeOption.sort));
  const guests = await db.select().from(nyeGuest).where(eq(nyeGuest.editionId, e.id)).orderBy(asc(nyeGuest.createdAt));
  const meals = await db.select().from(nyeMeal).where(eq(nyeMeal.editionId, e.id)).orderBy(asc(nyeMeal.day), asc(nyeMeal.sort));
  const tasks = await db.select().from(nyeTask).where(eq(nyeTask.editionId, e.id)).orderBy(asc(nyeTask.sort), asc(nyeTask.createdAt));
  const assigned = tasks.length ? await db.select().from(nyeTaskGuest).where(inArray(nyeTaskGuest.taskId, tasks.map((t) => t.id))) : [];
  const lists = await db.select().from(nyeList).where(eq(nyeList.editionId, e.id)).orderBy(asc(nyeList.sort));
  const items = lists.length ? await db.select().from(nyeItem).where(inArray(nyeItem.listId, lists.map((l) => l.id))).orderBy(asc(nyeItem.sort)) : [];
  const costs = await db.select().from(nyeCost).where(eq(nyeCost.editionId, e.id)).orderBy(asc(nyeCost.sort));
  const expenses = await db.select().from(nyeExpense).where(eq(nyeExpense.editionId, e.id)).orderBy(asc(nyeExpense.createdAt));

  const days = eventDays(e.startsOn, e.endsOn);
  const hc = headcount(
    guests.map((g) => ({ answer: g.answer as Answer, days: g.days })),
    days,
    meals,
    e.headcountOverride,
  );
  const listRows = lists.map((l) => {
    const rows: ItemRow[] = items
      .filter((it) => it.listId === l.id)
      .map((it) => ({ id: it.id, name: it.name, rule: it.rule as Rule, ratio: it.ratio, unit: it.unit, perPack: it.perPack, packPriceCents: it.packPriceCents, stock: it.stock, overridePacks: it.overridePacks, guestId: it.guestId, bought: it.bought, need: itemNeed({ rule: it.rule as Rule, ratio: it.ratio, perPack: it.perPack, packPriceCents: it.packPriceCents, stock: it.stock, overridePacks: it.overridePacks }, hc) }));
    return { id: l.id, name: l.name, split: l.split as Split, items: rows, totalCents: rows.reduce((a, r) => a + (r.need.costCents ?? 0), 0) };
  });
  const lineKey = (x: { costId: string | null; listId: string | null }) => (x.costId ? `cost:${x.costId}` : x.listId ? `list:${x.listId}` : null);
  const b = budget({
    days,
    guests: guests.map((g) => ({ id: g.id, answer: g.answer as Answer, days: g.days, optionId: g.optionId, receivedCents: g.receivedCents })),
    options: options.map((o) => ({ id: o.id, priceCents: o.priceCents })),
    lines: [...costs.map((c) => ({ key: `cost:${c.id}`, label: c.label, estimateCents: c.cents, split: c.split as Split })), ...listRows.map((l) => ({ key: `list:${l.id}`, label: l.name, estimateCents: l.totalCents, split: l.split }))],
    expenses: expenses.map((x) => ({ guestId: x.guestId, cents: x.cents, lineKey: lineKey(x) })),
  });
  const org = viewer.organizer;
  const mine = viewer.guest?.id ?? null;
  const invitedMembers = new Set(guests.map((g) => g.memberId).filter(Boolean));
  return {
    code: e.code,
    title: e.title,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    span: span(e.startsOn, e.endsOn),
    days,
    place: e.place,
    message: e.message,
    paymentInfo: e.paymentInfo,
    headcountOverride: e.headcountOverride,
    requestSentAt: e.requestSentAt?.toISOString() ?? null,
    organizer: org,
    isHost: viewer.memberId === e.hostMemberId,
    hostName: host?.name ?? "?",
    cohosts,
    options: options.map((o) => ({ id: o.id, label: o.label, priceCents: o.priceCents })),
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      isMember: !!g.memberId,
      answer: g.answer as Answer,
      days: g.days,
      optionId: g.optionId,
      diet: org || g.id === mine ? g.diet : g.diet ? "régime noté" : "",
      note: org || g.id === mine ? g.note : "",
      email: org ? g.email : null,
      token: org ? g.token : null,
      invited: !!g.invitedAt,
      mailError: org ? g.mailError : null,
      paidDeclared: !!g.paidDeclaredAt,
      receivedCents: org || g.id === mine ? g.receivedCents : 0,
      reminded: org ? (g.remindedAt?.toISOString() ?? null) : null,
    })),
    meals: meals.map((m) => ({ id: m.id, day: m.day, label: m.label, menu: m.menu })),
    tasks: tasks.map((t) => ({ id: t.id, pole: t.pole, title: t.title, due: t.due, status: t.status as "todo" | "doing" | "done", note: t.note, guestIds: assigned.filter((a) => a.taskId === t.id).map((a) => a.guestId) })),
    lists: listRows,
    costs: costs.map((c) => ({ id: c.id, label: c.label, cents: c.cents, split: c.split as Split })),
    // A guest sees their own expenses; the organizers see them all.
    expenses: expenses.filter((x) => org || x.guestId === mine).map((x) => ({ id: x.id, guestId: x.guestId, label: x.label, cents: x.cents, lineKey: lineKey(x), at: x.createdAt.toISOString() })),
    headcount: hc,
    budget: org ? b : { ...b, accounts: b.accounts.filter((a) => a.guestId === mine) },
    me: viewer.guest ? { guestId: viewer.guest.id, token: viewer.guest.token } : null,
    invitable: org ? (await listClubMembers()).filter((m) => !invitedMembers.has(m.id)) : [],
    memberIds: org ? Object.fromEntries(guests.filter((g) => g.memberId).map((g) => [g.id, g.memberId!])) : {},
  };
}

// ───────── The settings ─────────

export async function updateSettings(e: NyeEdition, s: { title: string; startsOn: string; endsOn: string; place: string; message: string; paymentInfo: string; headcountOverride: number | null }): Promise<Result> {
  if (s.endsOn < s.startsOn) return fail("La fin ne peut pas être avant le début.");
  if (eventDays(s.startsOn, s.endsOn).length > 14) return fail("Deux semaines au plus.");
  await db.update(nyeEdition).set(s).where(eq(nyeEdition.id, e.id));
  return OK;
}

export async function setCohost(e: NyeEdition, memberId: string, on: boolean): Promise<Result> {
  if (memberId === e.hostMemberId) return fail("La personne qui a créé l'édition l'organise déjà.");
  if (on) await db.insert(nyeCohost).values({ editionId: e.id, memberId }).onConflictDoNothing();
  else await db.delete(nyeCohost).where(and(eq(nyeCohost.editionId, e.id), eq(nyeCohost.memberId, memberId)));
  return OK;
}

// ───────── The guests ─────────

async function guestCount(e: NyeEdition) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(nyeGuest).where(eq(nyeGuest.editionId, e.id));
  return r?.n ?? 0;
}

export async function addMemberGuest(e: NyeEdition, memberId: string): Promise<Result> {
  if ((await guestCount(e)) >= LIMITS.guests) return fail(`${LIMITS.guests} invités au plus.`);
  const [m] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, memberId)).limit(1);
  if (!m) return fail("Membre introuvable.");
  if (await guestOfMember(e, memberId)) return fail(`${m.name} est déjà invité·e.`);
  await db.insert(nyeGuest).values({ editionId: e.id, memberId, name: m.name, token: newToken() });
  return OK;
}

/** Someone outside the club, by email; an address that is a member's adds the member. */
export async function addEmailGuest(e: NyeEdition, name: string, email: string): Promise<Result> {
  const address = email.trim().toLowerCase();
  const [account] = await db.select({ id: member.id }).from(member).innerJoin(user, eq(user.id, member.userId)).where(sql`lower(${user.email}) = ${address}`).limit(1);
  if (account) return addMemberGuest(e, account.id);
  if ((await guestCount(e)) >= LIMITS.guests) return fail(`${LIMITS.guests} invités au plus.`);
  const [taken] = await db
    .select({ id: nyeGuest.id })
    .from(nyeGuest)
    .where(and(eq(nyeGuest.editionId, e.id), sql`lower(${nyeGuest.email}) = ${address}`))
    .limit(1);
  if (taken) return fail("Cette adresse est déjà invitée.");
  await db.insert(nyeGuest).values({ editionId: e.id, name: name.trim(), email: address, token: newToken() });
  return OK;
}

export async function updateEmailGuest(e: NyeEdition, id: string, name: string, email: string): Promise<Result> {
  const address = email.trim().toLowerCase();
  await db
    .update(nyeGuest)
    .set({ name: name.trim(), email: address, mailError: null })
    .where(and(eq(nyeGuest.id, id), eq(nyeGuest.editionId, e.id), sql`${nyeGuest.memberId} is null`));
  return OK;
}

export async function removeGuest(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeGuest).where(and(eq(nyeGuest.id, id), eq(nyeGuest.editionId, e.id)));
  return OK;
}

/** What a guest says of themselves (or an organizer for them): their answer, their days, their option, their diet. */
export async function updateAnswer(e: NyeEdition, guestId: string, a: { answer?: Answer; days?: string[] | null; optionId?: string | null; diet?: string; note?: string }): Promise<Result> {
  const days = eventDays(e.startsOn, e.endsOn);
  const change: Partial<NyeGuest> = {};
  if (a.answer) change.answer = a.answer;
  if (a.days !== undefined) change.days = a.days && a.days.length && a.days.length < days.length ? days.filter((d) => a.days!.includes(d)) : null;
  if (a.optionId !== undefined) {
    if (a.optionId) {
      const [o] = await db
        .select({ id: nyeOption.id })
        .from(nyeOption)
        .where(and(eq(nyeOption.id, a.optionId), eq(nyeOption.editionId, e.id)))
        .limit(1);
      if (!o) return fail("Cette option n'existe plus.");
    }
    change.optionId = a.optionId;
  }
  if (a.diet !== undefined) change.diet = a.diet.trim();
  if (a.note !== undefined) change.note = a.note.trim();
  await db
    .update(nyeGuest)
    .set(change)
    .where(and(eq(nyeGuest.id, guestId), eq(nyeGuest.editionId, e.id)));
  return OK;
}

// ───────── The mails ─────────

async function addressOf(g: NyeGuest): Promise<{ email: string | null; prefs: unknown }> {
  if (!g.memberId) return { email: g.email, prefs: null };
  const [m] = await db.select({ email: user.email, prefs: member.notifPrefs }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, g.memberId)).limit(1);
  return { email: m?.email ?? null, prefs: m?.prefs ?? null };
}

/**
 * One mail to one guest, and for a member the notification in the club as well. A member who turned
 * off these mails still gets the notification; a guest from outside always gets the mail (it's all
 * they have).
 */
async function tell(e: NyeEdition, g: NyeGuest, m: { kind: string; subject: string; heading: string; lines: string[]; amountCents?: number | null; cta: string }): Promise<boolean> {
  const { email, prefs } = await addressOf(g);
  if (g.memberId) {
    try {
      await createNotification({ memberId: g.memberId, kind: m.kind, entityRef: `nye:${e.id}`, payload: { code: e.code, title: e.title, text: m.heading } });
    } catch (error) {
      console.error("New Year notification failed", error);
    }
  }
  if (!email || (g.memberId && !wantsEmail(prefs, "nouvelan"))) return !!g.memberId;
  const link = guestLink(g.token);
  try {
    await sendMail({
      to: email,
      subject: m.subject,
      react: NyeEmail({ heading: m.heading, lines: m.lines, amount: m.amountCents ? euros(m.amountCents) : null, payment: m.amountCents ? e.paymentInfo : null, link, cta: m.cta }),
      devFallbackMessage: `New Year link for ${email}:\n${link}`,
    });
    await db.update(nyeGuest).set({ mailError: null }).where(eq(nyeGuest.id, g.id));
    return true;
  } catch (error) {
    console.error("New Year mail not sent", error);
    await db.update(nyeGuest).set({ mailError: "Le mail n'est pas parti" }).where(eq(nyeGuest.id, g.id));
    return false;
  }
}

const gently = () => (process.env.RESEND_API_KEY ? new Promise((r) => setTimeout(r, 600)) : Promise.resolve());

/** The invitation: everyone not invited yet (or the ones given), with their personal link to answer. */
export async function sendInvitations(e: NyeEdition, organizer: string, ids: string[] | null): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const guests = await db.select().from(nyeGuest).where(eq(nyeGuest.editionId, e.id));
  const targets = guests.filter((g) => (ids ? ids.includes(g.id) : !g.invitedAt) && g.memberId !== e.hostMemberId);
  let sent = 0;
  for (const g of targets) {
    const ok = await tell(e, g, {
      kind: "nye.invited",
      subject: `🥂 ${e.title} : tu es invité·e`,
      heading: `${organizer} t'invite au ${e.title}`,
      lines: [`C'est ${span(e.startsOn, e.endsOn)}${e.place ? `, ${e.place}` : ""}.`, ...(e.message ? [e.message] : []), "Dis-nous si tu viens, quels jours, et ce que tu ne manges pas."],
      cta: "Répondre",
    });
    if (ok) {
      sent += 1;
      await db.update(nyeGuest).set({ invitedAt: new Date() }).where(eq(nyeGuest.id, g.id));
    }
    await gently();
  }
  return { ok: true, sent };
}

async function balances(e: NyeEdition) {
  const view = await buildView(e, { organizer: true, memberId: null, guest: null });
  return new Map(view.budget.accounts.map((a) => [a.guestId, a.balanceCents]));
}

/**
 * The request to pay, or the reminder: to each guest who said yes and still owes something, their
 * amount and how to pay. The reminder skips those who said « j'ai payé » (the organizers check first).
 */
export async function sendPaymentMails(e: NyeEdition, kind: "request" | "reminder"): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  if (!e.paymentInfo.trim()) return fail("Écris d'abord comment payer (Réglages › Comment payer), par exemple « Wero au 06… ».");
  const owed = await balances(e);
  const guests = await db.select().from(nyeGuest).where(and(eq(nyeGuest.editionId, e.id), eq(nyeGuest.answer, "yes")));
  const targets = guests.filter((g) => (owed.get(g.id) ?? 0) > 0 && (kind === "request" || !g.paidDeclaredAt));
  if (!targets.length) return fail(kind === "request" ? "Personne n'a rien à payer pour l'instant." : "Personne à relancer : tout le monde a payé ou dit l'avoir fait.");
  let sent = 0;
  for (const g of targets) {
    const cents = owed.get(g.id) ?? 0;
    const ok = await tell(e, g, {
      kind: kind === "request" ? "nye.request" : "nye.reminder",
      subject: kind === "request" ? `🥂 ${e.title} : ta participation` : `🥂 ${e.title} : petit rappel pour ta participation`,
      heading: kind === "request" ? `Ta participation au ${e.title}` : `Petit rappel : ta participation au ${e.title}`,
      lines: kind === "request" ? [`${g.name.split(" ")[0]}, voici ta part (le lieu, les repas, les boissons et le reste, ${span(e.startsOn, e.endsOn)}).`, "Le détail est sur ta page. Une fois payé, dis-le d'un clic."] : [`${g.name.split(" ")[0]}, on n'a pas encore vu passer ta participation.`, "Si c'est fait, dis-le d'un clic sur ta page."],
      amountCents: cents,
      cta: "Voir le détail",
    });
    if (ok) {
      sent += 1;
      if (kind === "reminder") await db.update(nyeGuest).set({ remindedAt: new Date() }).where(eq(nyeGuest.id, g.id));
    }
    await gently();
  }
  if (kind === "request") await db.update(nyeEdition).set({ requestSentAt: new Date() }).where(eq(nyeEdition.id, e.id));
  return { ok: true, sent };
}

// ───────── Payments ─────────

export async function declarePaid(e: NyeEdition, guestId: string, paid: boolean): Promise<Result> {
  await db
    .update(nyeGuest)
    .set({ paidDeclaredAt: paid ? new Date() : null })
    .where(and(eq(nyeGuest.id, guestId), eq(nyeGuest.editionId, e.id)));
  return OK;
}

/** What the organizers confirm having received from a guest (in all). */
export async function setReceived(e: NyeEdition, guestId: string, cents: number): Promise<Result> {
  await db
    .update(nyeGuest)
    .set({ receivedCents: Math.max(0, cents), receivedAt: cents > 0 ? new Date() : null })
    .where(and(eq(nyeGuest.id, guestId), eq(nyeGuest.editionId, e.id)));
  return OK;
}

// ───────── Options, meals, missions, lists, costs, expenses ─────────

export async function saveOption(e: NyeEdition, o: { id: string | null; label: string; priceCents: number }): Promise<Result> {
  if (o.id)
    await db
      .update(nyeOption)
      .set({ label: o.label, priceCents: o.priceCents })
      .where(and(eq(nyeOption.id, o.id), eq(nyeOption.editionId, e.id)));
  else await db.insert(nyeOption).values({ editionId: e.id, label: o.label, priceCents: o.priceCents, sort: Date.now() % 1_000_000 });
  return OK;
}

export async function removeOption(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeOption).where(and(eq(nyeOption.id, id), eq(nyeOption.editionId, e.id)));
  return OK;
}

export async function saveMeal(e: NyeEdition, m: { id: string | null; day: string; label: string; menu: string }): Promise<Result> {
  if (!eventDays(e.startsOn, e.endsOn).includes(m.day)) return fail("Ce jour n'est pas dans les dates du nouvel an.");
  if (m.id)
    await db
      .update(nyeMeal)
      .set({ day: m.day, label: m.label, menu: m.menu })
      .where(and(eq(nyeMeal.id, m.id), eq(nyeMeal.editionId, e.id)));
  else await db.insert(nyeMeal).values({ editionId: e.id, day: m.day, label: m.label, menu: m.menu, sort: Date.now() % 1_000_000 });
  return OK;
}

export async function removeMeal(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeMeal).where(and(eq(nyeMeal.id, id), eq(nyeMeal.editionId, e.id)));
  return OK;
}

export async function saveTask(e: NyeEdition, t: { id: string | null; pole: string; title: string; due: string; status: "todo" | "doing" | "done"; note: string }): Promise<Result> {
  if (t.id)
    await db
      .update(nyeTask)
      .set({ pole: t.pole, title: t.title, due: t.due, status: t.status, note: t.note })
      .where(and(eq(nyeTask.id, t.id), eq(nyeTask.editionId, e.id)));
  else await db.insert(nyeTask).values({ editionId: e.id, pole: t.pole, title: t.title, due: t.due, status: t.status, note: t.note, sort: 1000 + (Date.now() % 1_000_000) });
  return OK;
}

export async function removeTask(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeTask).where(and(eq(nyeTask.id, id), eq(nyeTask.editionId, e.id)));
  return OK;
}

async function ownTask(e: NyeEdition, taskId: string) {
  const [t] = await db
    .select({ id: nyeTask.id })
    .from(nyeTask)
    .where(and(eq(nyeTask.id, taskId), eq(nyeTask.editionId, e.id)))
    .limit(1);
  return !!t;
}

async function ownGuest(e: NyeEdition, guestId: string) {
  const [g] = await db
    .select({ id: nyeGuest.id })
    .from(nyeGuest)
    .where(and(eq(nyeGuest.id, guestId), eq(nyeGuest.editionId, e.id)))
    .limit(1);
  return !!g;
}

/** « Je m'en charge », or an organizer putting someone on a mission (or taking them off). */
export async function assignTask(e: NyeEdition, taskId: string, guestId: string, on: boolean): Promise<Result> {
  if (!(await ownTask(e, taskId)) || !(await ownGuest(e, guestId))) return fail("Mission introuvable.");
  if (on) await db.insert(nyeTaskGuest).values({ taskId, guestId }).onConflictDoNothing();
  else await db.delete(nyeTaskGuest).where(and(eq(nyeTaskGuest.taskId, taskId), eq(nyeTaskGuest.guestId, guestId)));
  return OK;
}

/** A mission's progress, by the organizers or by whoever took it on. */
export async function setTaskStatus(e: NyeEdition, taskId: string, status: "todo" | "doing" | "done"): Promise<Result> {
  await db
    .update(nyeTask)
    .set({ status })
    .where(and(eq(nyeTask.id, taskId), eq(nyeTask.editionId, e.id)));
  return OK;
}

export async function isOnTask(taskId: string, guestId: string): Promise<boolean> {
  const [r] = await db
    .select({ id: nyeTaskGuest.taskId })
    .from(nyeTaskGuest)
    .where(and(eq(nyeTaskGuest.taskId, taskId), eq(nyeTaskGuest.guestId, guestId)))
    .limit(1);
  return !!r;
}

export async function saveList(e: NyeEdition, l: { id: string | null; name: string; split: "presence" | "equal" }): Promise<Result> {
  if (l.id)
    await db
      .update(nyeList)
      .set({ name: l.name, split: l.split })
      .where(and(eq(nyeList.id, l.id), eq(nyeList.editionId, e.id)));
  else await db.insert(nyeList).values({ editionId: e.id, name: l.name, split: l.split, sort: Date.now() % 1_000_000 });
  return OK;
}

export async function removeList(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeList).where(and(eq(nyeList.id, id), eq(nyeList.editionId, e.id)));
  return OK;
}

async function listOf(e: NyeEdition, listId: string) {
  const [l] = await db
    .select({ id: nyeList.id })
    .from(nyeList)
    .where(and(eq(nyeList.id, listId), eq(nyeList.editionId, e.id)))
    .limit(1);
  return !!l;
}

async function itemOf(e: NyeEdition, itemId: string) {
  const [it] = await db
    .select({ item: nyeItem })
    .from(nyeItem)
    .innerJoin(nyeList, eq(nyeList.id, nyeItem.listId))
    .where(and(eq(nyeItem.id, itemId), eq(nyeList.editionId, e.id)))
    .limit(1);
  return it?.item ?? null;
}

export interface ItemInput {
  id: string | null;
  listId: string;
  name: string;
  rule: Rule;
  ratio: number;
  unit: string;
  perPack: number;
  packPriceCents: number | null;
  stock: number;
  overridePacks: number | null;
}

export async function saveItem(e: NyeEdition, it: ItemInput): Promise<Result> {
  if (!(await listOf(e, it.listId))) return fail("Liste introuvable.");
  const values = { listId: it.listId, name: it.name, rule: it.rule, ratio: it.ratio, unit: it.unit, perPack: Math.max(1, it.perPack), packPriceCents: it.packPriceCents, stock: Math.max(0, it.stock), overridePacks: it.overridePacks };
  if (it.id) {
    if (!(await itemOf(e, it.id))) return fail("Article introuvable.");
    await db.update(nyeItem).set(values).where(eq(nyeItem.id, it.id));
  } else await db.insert(nyeItem).values({ ...values, sort: Date.now() % 1_000_000 });
  return OK;
}

export async function removeItem(e: NyeEdition, id: string): Promise<Result> {
  if (!(await itemOf(e, id))) return fail("Article introuvable.");
  await db.delete(nyeItem).where(eq(nyeItem.id, id));
  return OK;
}

/** Who takes care of a line (a guest for themselves, or an organizer for anyone), and whether it's bought. */
export async function setItemCare(e: NyeEdition, id: string, change: { guestId?: string | null; bought?: boolean }): Promise<Result> {
  const it = await itemOf(e, id);
  if (!it) return fail("Article introuvable.");
  if (change.guestId && !(await ownGuest(e, change.guestId))) return fail("Invité introuvable.");
  await db.update(nyeItem).set(change).where(eq(nyeItem.id, id));
  return OK;
}

export async function itemCarer(e: NyeEdition, id: string): Promise<string | null | undefined> {
  return (await itemOf(e, id))?.guestId;
}

export async function saveCost(e: NyeEdition, c: { id: string | null; label: string; cents: number; split: Split }): Promise<Result> {
  if (c.id)
    await db
      .update(nyeCost)
      .set({ label: c.label, cents: c.cents, split: c.split })
      .where(and(eq(nyeCost.id, c.id), eq(nyeCost.editionId, e.id)));
  else await db.insert(nyeCost).values({ editionId: e.id, label: c.label, cents: c.cents, split: c.split, sort: Date.now() % 1_000_000 });
  return OK;
}

export async function removeCost(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeCost).where(and(eq(nyeCost.id, id), eq(nyeCost.editionId, e.id)));
  return OK;
}

/** Money someone advanced, on a line of the budget (« cost:… », « list:… ») or on none. */
export async function addExpense(e: NyeEdition, x: { guestId: string; label: string; cents: number; lineKey: string | null }): Promise<Result> {
  if (!(await ownGuest(e, x.guestId))) return fail("Invité introuvable.");
  const [kind, id] = (x.lineKey ?? "").split(":");
  let costId: string | null = null;
  let listId: string | null = null;
  if (kind === "cost" && id) {
    const [c] = await db
      .select({ id: nyeCost.id })
      .from(nyeCost)
      .where(and(eq(nyeCost.id, id), eq(nyeCost.editionId, e.id)))
      .limit(1);
    costId = c?.id ?? null;
  }
  if (kind === "list" && id && (await listOf(e, id))) listId = id;
  await db.insert(nyeExpense).values({ editionId: e.id, guestId: x.guestId, label: x.label, cents: x.cents, costId, listId });
  return OK;
}

export async function expenseOwner(e: NyeEdition, id: string): Promise<string | null> {
  const [x] = await db
    .select({ guestId: nyeExpense.guestId })
    .from(nyeExpense)
    .where(and(eq(nyeExpense.id, id), eq(nyeExpense.editionId, e.id)))
    .limit(1);
  return x?.guestId ?? null;
}

export async function removeExpense(e: NyeEdition, id: string): Promise<Result> {
  await db.delete(nyeExpense).where(and(eq(nyeExpense.id, id), eq(nyeExpense.editionId, e.id)));
  return OK;
}

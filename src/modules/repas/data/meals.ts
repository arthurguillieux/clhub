import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { item, mealClaim, mealGuest, mealItem, member, menuEvent, user, type MealGuest, type MenuEvent } from "@/core/db/schema";
import { parseDietaryTags } from "@/core/dietaryTags";
import { sendMail } from "@/core/mail/send";
import { MealEmail } from "@/core/mail/templates/MealEmail";
import { createNotification } from "@/core/notifications";
import { wantsEmail } from "@/core/notifications/preferences";
import { createExpenseEvent } from "@/modules/caisse/data/events";
import { amount, coverage, feast, restOf, type Category } from "../domain/list";
import type { Proposal } from "../domain/templates";

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const newToken = () => randomBytes(24).toString("base64url");
export const mealLink = (token: string) => `${appUrl()}/repas/invitation/${token}`;

// ───────── Who's acting ─────────

/** Who acts on a meal: the organizer (its creator, or an admin in admin mode), and/or one of its guests. */
export interface Actor {
  organizer: boolean;
  guest: MealGuest | null;
  /** A signed-in member who isn't a guest (yet): they may join an open meal. */
  memberId: string | null;
}

export async function getMeal(id: string): Promise<MenuEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(menuEvent).where(eq(menuEvent.id, id)).limit(1);
  return row ?? null;
}

export async function getMealByToken(token: string): Promise<MenuEvent | null> {
  if (!/^[\w-]{16,80}$/.test(token)) return null;
  const [row] = await db.select().from(menuEvent).where(eq(menuEvent.token, token)).limit(1);
  return row ?? null;
}

export async function guestOfMember(mealId: string, memberId: string): Promise<MealGuest | null> {
  const [row] = await db.select().from(mealGuest).where(and(eq(mealGuest.eventId, mealId), eq(mealGuest.memberId, memberId))).limit(1);
  return row ?? null;
}

export async function guestOfKey(mealId: string, key: string | null): Promise<MealGuest | null> {
  if (!key || !/^[\w-]{20,64}$/.test(key)) return null;
  const [row] = await db.select().from(mealGuest).where(and(eq(mealGuest.eventId, mealId), eq(mealGuest.claimKey, key))).limit(1);
  return row ?? null;
}

// ───────── Reading ─────────

export interface GuestView {
  id: string;
  name: string;
  member: boolean;
  status: string | null;
  plusOnes: number;
  vege: boolean;
  claims: number;
  /** Someone already said « c'est moi » for this name (guests without an account). */
  taken: boolean;
}

export interface ItemView {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  amount: string;
  category: Category;
  covered: boolean;
  promised: number;
  missing: number;
  missingLabel: string;
  canEdit: boolean;
  claims: { id: string; guestId: string; name: string; quantity: number | null; amount: string; bought: boolean; mine: boolean }[];
  /** What « Je ramène tout » takes for me. */
  rest: number | null;
  /** Prêtothèque objects that might do the job (material lines). */
  loans: { name: string; owner: string; slug: string }[];
}

export interface MealView {
  id: string;
  title: string;
  note: string | null;
  date: string;
  time: string | null;
  place: string | null;
  open: boolean;
  template: string | null;
  link: string;
  organizerName: string;
  organizer: boolean;
  me: GuestView | null;
  /** A signed-in member who may join (open meal). */
  canJoin: boolean;
  guests: GuestView[];
  items: ItemView[];
  feast: number;
  /** For the calculator: who said yes (with their +1), végés counted from profiles. */
  counts: { vege: number; meat: number };
  caisseEventId: string | null;
  /** The club's members, to invite (organizer only). */
  members: { id: string; name: string }[];
}

export async function getMealView(meal: MenuEvent, actor: Actor): Promise<MealView> {
  const guests = await db
    .select({ guest: mealGuest, tags: member.dietaryTags })
    .from(mealGuest)
    .leftJoin(member, eq(member.id, mealGuest.memberId))
    .where(eq(mealGuest.eventId, meal.id))
    .orderBy(asc(mealGuest.createdAt));
  const items = await db.select().from(mealItem).where(eq(mealItem.eventId, meal.id)).orderBy(asc(mealItem.position), asc(mealItem.createdAt));
  const claims = items.length ? await db.select().from(mealClaim).where(inArray(mealClaim.itemId, items.map((i) => i.id))).orderBy(asc(mealClaim.createdAt)) : [];
  const [organizer] = await db.select({ name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(eq(member.id, meal.createdById)).limit(1);
  const nameOf = new Map(guests.map((g) => [g.guest.id, g.guest.name]));
  const isVege = (g: (typeof guests)[number]) => g.guest.vege ?? parseDietaryTags(g.tags).some((t) => t === "vegetarien" || t === "vegan");
  const me = actor.guest;

  // Material lines: what the Prêtothèque already has (a word of 4 letters or more in common).
  const needsLoans = items.some((i) => i.category === "materiel");
  const loanable = needsLoans
    ? await db.select({ name: item.name, slug: item.slug, owner: user.name }).from(item).innerJoin(member, eq(member.id, item.ownerId)).innerJoin(user, eq(user.id, member.userId))
    : [];
  const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^a-z]+/).filter((w) => w.length >= 4);

  const itemViews: ItemView[] = items.map((i) => {
    const mine = claims.filter((c) => c.itemId === i.id);
    const line = { quantity: i.quantity, claims: mine.map((c) => ({ guestId: c.guestId, quantity: c.quantity })) };
    const cov = coverage(line);
    const w = words(i.label);
    return {
      id: i.id,
      label: i.label,
      quantity: i.quantity,
      unit: i.unit,
      amount: amount(i.quantity, i.unit),
      category: (i.category as Category) ?? "manger",
      covered: cov.covered,
      promised: cov.promised,
      missing: cov.missing,
      missingLabel: i.quantity !== null ? amount(cov.missing, i.unit) : "",
      canEdit: actor.organizer || (!!me && i.addedByGuestId === me.id),
      claims: mine.map((c) => ({ id: c.id, guestId: c.guestId, name: nameOf.get(c.guestId) ?? "?", quantity: c.quantity, amount: c.quantity === null ? (i.quantity !== null ? "tout" : "") : amount(c.quantity, i.unit), bought: c.bought, mine: !!me && c.guestId === me.id })),
      rest: me ? restOf(line, me.id) : i.quantity,
      loans: i.category === "materiel" ? loanable.filter((l) => words(l.name).some((x) => w.includes(x))).slice(0, 3) : [],
    };
  });

  const guestViews: GuestView[] = guests.map((g) => ({
    id: g.guest.id,
    name: g.guest.name,
    member: !!g.guest.memberId,
    status: g.guest.status,
    plusOnes: g.guest.plusOnes,
    vege: isVege(g),
    claims: claims.filter((c) => c.guestId === g.guest.id).length,
    taken: !!g.guest.claimKey,
  }));
  const coming = guests.filter((g) => g.guest.status === "yes");
  const counted = coming.length ? coming : guests.filter((g) => g.guest.status !== "no");
  const vege = counted.filter(isVege).length;
  const total = counted.reduce((s, g) => s + 1 + g.guest.plusOnes, 0);
  const members = actor.organizer
    ? await db.select({ id: member.id, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name))
    : [];

  return {
    id: meal.id,
    title: meal.title,
    note: meal.description,
    date: meal.eventDate,
    time: meal.time,
    place: meal.place,
    open: meal.open,
    template: meal.template,
    link: mealLink(meal.token ?? ""),
    organizerName: organizer?.name ?? "Un membre",
    organizer: actor.organizer,
    me: me ? (guestViews.find((g) => g.id === me.id) ?? null) : null,
    canJoin: !me && !!actor.memberId && meal.open,
    guests: guestViews,
    items: itemViews,
    feast: feast(itemViews.map((i) => ({ quantity: i.quantity, claims: i.claims.map((c) => ({ guestId: c.guestId, quantity: c.quantity })) }))),
    counts: { vege, meat: Math.max(0, total - vege) },
    caisseEventId: meal.caisseEventId,
    members,
  };
}

/** The meals a member sees: the ones they organize or are invited to, and the open ones. */
export async function listMealsFor(memberId: string, admin: boolean) {
  const mine = db.select({ id: mealGuest.eventId }).from(mealGuest).where(eq(mealGuest.memberId, memberId));
  const meals = await db
    .select({ meal: menuEvent, organizer: user.name })
    .from(menuEvent)
    .innerJoin(member, eq(member.id, menuEvent.createdById))
    .innerJoin(user, eq(user.id, member.userId))
    .where(admin ? undefined : or(eq(menuEvent.createdById, memberId), eq(menuEvent.open, true), inArray(menuEvent.id, mine)));
  if (!meals.length) return [];
  const ids = meals.map((m) => m.meal.id);
  const guests = await db.select().from(mealGuest).where(inArray(mealGuest.eventId, ids));
  const items = await db.select({ id: mealItem.id, eventId: mealItem.eventId, quantity: mealItem.quantity }).from(mealItem).where(inArray(mealItem.eventId, ids));
  const claims = items.length ? await db.select().from(mealClaim).where(inArray(mealClaim.itemId, items.map((i) => i.id))) : [];
  const today = new Date().toISOString().slice(0, 10);
  return meals
    .map(({ meal, organizer }) => {
      const its = items.filter((i) => i.eventId === meal.id);
      const myGuest = guests.find((g) => g.eventId === meal.id && g.memberId === memberId);
      return {
        id: meal.id,
        title: meal.title,
        date: meal.eventDate,
        time: meal.time,
        place: meal.place,
        organizer,
        mine: meal.createdById === memberId,
        invited: !!myGuest,
        coming: guests.filter((g) => g.eventId === meal.id && g.status === "yes").reduce((s, g) => s + 1 + g.plusOnes, 0),
        feast: feast(its.map((i) => ({ quantity: i.quantity, claims: claims.filter((c) => c.itemId === i.id) }))),
        myClaims: myGuest ? claims.filter((c) => c.guestId === myGuest.id).length : 0,
        upcoming: meal.eventDate >= today,
      };
    })
    .sort((a, b) => (a.upcoming !== b.upcoming ? (a.upcoming ? -1 : 1) : a.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
}

// ───────── The meal ─────────

export interface MealInput {
  title: string;
  date: string;
  time: string | null;
  place: string | null;
  note: string | null;
  open: boolean;
}

/** A new meal: its link, and its organizer as its first guest. */
export async function createMeal(memberId: string, name: string, input: MealInput): Promise<MenuEvent> {
  const [row] = await db
    .insert(menuEvent)
    .values({ createdById: memberId, title: input.title, eventDate: input.date, time: input.time, place: input.place, description: input.note, open: input.open, token: newToken() })
    .returning();
  if (!row) throw new Error("meal not created");
  await db.insert(mealGuest).values({ eventId: row.id, memberId, name, status: "yes" });
  return row;
}

export async function updateMeal(meal: MenuEvent, input: MealInput): Promise<Result> {
  await db.update(menuEvent).set({ title: input.title, eventDate: input.date, time: input.time, place: input.place, description: input.note, open: input.open, reminderSentAt: null }).where(eq(menuEvent.id, meal.id));
  return { ok: true };
}

export async function deleteMeal(meal: MenuEvent): Promise<void> {
  await db.delete(menuEvent).where(eq(menuEvent.id, meal.id));
}

// ───────── The guests ─────────

/** Club members invited (they hear of it) and first names without an account (they come through the link). */
export async function inviteGuests(meal: MenuEvent, organizerName: string, input: { memberIds: string[]; names: string[] }): Promise<Result> {
  const added: string[] = [];
  if (input.memberIds.length) {
    const people = await db.select({ id: member.id, name: user.name, email: user.email, prefs: member.notifPrefs }).from(member).innerJoin(user, eq(user.id, member.userId)).where(inArray(member.id, input.memberIds));
    for (const p of people) {
      const [row] = await db.insert(mealGuest).values({ eventId: meal.id, memberId: p.id, name: p.name }).onConflictDoNothing().returning({ id: mealGuest.id });
      if (!row) continue;
      added.push(p.name);
      await notify(meal, { id: p.id, email: p.email, prefs: p.prefs }, "meal.invited", `${organizerName} t'invite : ${meal.title}`, [`Le ${frDate(meal.eventDate)}${meal.time ? ` à ${meal.time}` : ""}${meal.place ? `, ${meal.place}` : ""}.`, "Dis si tu viens, et choisis ce que tu ramènes."], "Voir le repas");
    }
  }
  for (const raw of input.names) {
    const name = raw.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!name) continue;
    await db.insert(mealGuest).values({ eventId: meal.id, name });
    added.push(name);
  }
  return added.length ? { ok: true } : fail("Personne de nouveau à inviter.");
}

export async function removeGuest(meal: MenuEvent, guestId: string): Promise<Result> {
  await db.delete(mealGuest).where(and(eq(mealGuest.id, guestId), eq(mealGuest.eventId, meal.id)));
  return { ok: true };
}

/** An open meal: a member adds themselves. */
export async function joinMeal(meal: MenuEvent, memberId: string, name: string): Promise<Result> {
  if (!meal.open) return fail("Ce repas est sur invitation.");
  await db.insert(mealGuest).values({ eventId: meal.id, memberId, name, status: "yes" }).onConflictDoNothing();
  return { ok: true };
}

/** « C'est moi » on the link: this browser now speaks for that guest (a new key, the old browser lets go). */
export async function claimGuest(meal: MenuEvent, guestId: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const key = randomBytes(24).toString("base64url");
  const [row] = await db.update(mealGuest).set({ claimKey: key }).where(and(eq(mealGuest.id, guestId), eq(mealGuest.eventId, meal.id), isNull(mealGuest.memberId))).returning({ id: mealGuest.id });
  return row ? { ok: true, key } : fail("Ce prénom n'est pas sur la liste des invités sans compte.");
}

/** « Je ne suis pas sur la liste »: a first name added by the guest themselves. */
export async function addSelf(meal: MenuEvent, raw: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) return fail("Il manque ton prénom.");
  const key = randomBytes(24).toString("base64url");
  await db.insert(mealGuest).values({ eventId: meal.id, name, claimKey: key, status: "yes" });
  return { ok: true, key };
}

export async function setResponse(meal: MenuEvent, guest: MealGuest, input: { status: "yes" | "maybe" | "no"; plusOnes: number; vege: boolean | null }): Promise<Result> {
  await db.update(mealGuest).set({ status: input.status, plusOnes: Math.max(0, Math.min(10, input.plusOnes)), vege: guest.memberId ? guest.vege : input.vege }).where(eq(mealGuest.id, guest.id));
  // The organizer hears when someone says they're coming, not at every change.
  if (input.status === "yes" && guest.status !== "yes" && guest.memberId !== meal.createdById) {
    await createNotification({ memberId: meal.createdById, kind: "meal.response", entityRef: `menu:${meal.id}`, payload: { mealId: meal.id, title: meal.title, name: guest.name } });
  }
  return { ok: true };
}

// ───────── The list ─────────

export interface ItemInput {
  label: string;
  quantity: number | null;
  unit: string | null;
  category: Category;
}

export async function addItem(meal: MenuEvent, by: MealGuest | null, input: ItemInput): Promise<Result> {
  const [last] = await db.select({ p: sql<number>`coalesce(max(${mealItem.position}), 0)` }).from(mealItem).where(eq(mealItem.eventId, meal.id));
  await db.insert(mealItem).values({ eventId: meal.id, label: input.label, quantity: input.quantity, unit: input.quantity === null ? null : input.unit, category: input.category, addedByGuestId: by?.id ?? null, position: (last?.p ?? 0) + 1 });
  return { ok: true };
}

async function itemOf(meal: MenuEvent, itemId: string) {
  const [row] = await db.select().from(mealItem).where(and(eq(mealItem.id, itemId), eq(mealItem.eventId, meal.id))).limit(1);
  return row ?? null;
}

const canEdit = (actor: Actor, it: { addedByGuestId: string | null }) => actor.organizer || (!!actor.guest && it.addedByGuestId === actor.guest.id);

export async function updateItem(meal: MenuEvent, actor: Actor, itemId: string, input: ItemInput): Promise<Result> {
  const it = await itemOf(meal, itemId);
  if (!it) return fail("Cette ligne n'existe plus.");
  if (!canEdit(actor, it)) return fail("Seuls l'organisateur et la personne qui l'a ajoutée peuvent la changer.");
  await db.update(mealItem).set({ label: input.label, quantity: input.quantity, unit: input.quantity === null ? null : input.unit, category: input.category }).where(eq(mealItem.id, itemId));
  return { ok: true };
}

export async function removeItem(meal: MenuEvent, actor: Actor, itemId: string): Promise<Result> {
  const it = await itemOf(meal, itemId);
  if (!it) return { ok: true };
  if (!canEdit(actor, it)) return fail("Seuls l'organisateur et la personne qui l'a ajoutée peuvent la retirer.");
  await db.delete(mealItem).where(eq(mealItem.id, itemId));
  return { ok: true };
}

/** « Je ramène tout » (the rest of the line), « J'en ramène… » (part of it), or a change of mind. */
export async function claimItem(meal: MenuEvent, guest: MealGuest, itemId: string, quantity: number | "all"): Promise<Result> {
  const it = await itemOf(meal, itemId);
  if (!it) return fail("Cette ligne n'existe plus.");
  const others = await db.select().from(mealClaim).where(eq(mealClaim.itemId, itemId));
  const line = { quantity: it.quantity, claims: others.map((c) => ({ guestId: c.guestId, quantity: c.quantity })) };
  const q = quantity === "all" ? restOf(line, guest.id) : it.quantity === null ? null : quantity;
  if (q === 0) return fail("Quelqu'un ramène déjà tout.");
  await db
    .insert(mealClaim)
    .values({ itemId, guestId: guest.id, quantity: q })
    .onConflictDoUpdate({ target: [mealClaim.itemId, mealClaim.guestId], set: { quantity: q } });
  return { ok: true };
}

export async function unclaimItem(guest: MealGuest, itemId: string): Promise<Result> {
  await db.delete(mealClaim).where(and(eq(mealClaim.itemId, itemId), eq(mealClaim.guestId, guest.id)));
  return { ok: true };
}

export async function setBought(guest: MealGuest, claimId: string, bought: boolean): Promise<Result> {
  await db.update(mealClaim).set({ bought }).where(and(eq(mealClaim.id, claimId), eq(mealClaim.guestId, guest.id)));
  return { ok: true };
}

/** The calculator's list: new lines added, the same line (same name) gets the new amount. */
export async function applyProposals(meal: MenuEvent, template: string, proposals: Proposal[]): Promise<Result> {
  const existing = await db.select().from(mealItem).where(eq(mealItem.eventId, meal.id));
  let position = existing.reduce((m, i) => Math.max(m, i.position), 0);
  for (const p of proposals) {
    const same = existing.find((i) => i.label.trim().toLowerCase() === p.label.trim().toLowerCase());
    if (same) await db.update(mealItem).set({ quantity: p.quantity, unit: p.unit, category: p.category }).where(eq(mealItem.id, same.id));
    else await db.insert(mealItem).values({ eventId: meal.id, label: p.label, quantity: p.quantity, unit: p.unit, category: p.category, position: ++position });
  }
  await db.update(menuEvent).set({ template }).where(eq(menuEvent.id, meal.id));
  return { ok: true };
}

// ───────── Around the meal ─────────

async function notify(meal: MenuEvent, person: { id: string; email: string | null; prefs: unknown }, kind: string, heading: string, lines: string[], cta: string) {
  try {
    await createNotification({ memberId: person.id, kind, entityRef: `menu:${meal.id}`, payload: { mealId: meal.id, title: meal.title, text: heading } });
    if (person.email && wantsEmail(person.prefs, "repas")) {
      await sendMail({ to: person.email, subject: `🍽️ ${heading}`, react: MealEmail({ heading, lines, link: `${appUrl()}/repas/${meal.id}`, cta }), devFallbackMessage: `${person.email}: ${heading}` });
    }
  } catch (error) {
    console.error("Meal notification failed", error);
  }
}

const frDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « Relancer »: the member guests who haven't said what they bring (and haven't said no). */
export async function nudge(meal: MenuEvent): Promise<{ ok: true; count: number }> {
  const view = await getMealView(meal, { organizer: true, guest: null, memberId: null });
  const silent = view.guests.filter((g) => g.member && g.claims === 0 && g.status !== "no");
  const people = silent.length
    ? await db.select({ id: member.id, email: user.email, prefs: member.notifPrefs, guestId: mealGuest.id }).from(mealGuest).innerJoin(member, eq(member.id, mealGuest.memberId)).innerJoin(user, eq(user.id, member.userId)).where(inArray(mealGuest.id, silent.map((g) => g.id)))
    : [];
  const missing = view.items.filter((i) => !i.covered).map((i) => (i.missingLabel ? `${i.label} (${i.missingLabel})` : i.label));
  for (const p of people) {
    if (p.id === meal.createdById) continue;
    await notify(meal, p, "meal.nudge", `${meal.title} : on compte sur toi !`, [missing.length ? `Il manque encore : ${missing.slice(0, 6).join(", ")}.` : "Dis ce que tu ramènes."], "Choisir ce que je ramène");
  }
  return { ok: true, count: people.filter((p) => p.id !== meal.createdById).length };
}

/** The day before: every member guest coming hears what they bring. Called by the nightly tasks. */
export async function sendMealReminders(): Promise<number> {
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const meals = await db.select().from(menuEvent).where(and(eq(menuEvent.eventDate, tomorrow), isNull(menuEvent.reminderSentAt)));
  let sent = 0;
  for (const meal of meals) {
    const view = await getMealView(meal, { organizer: true, guest: null, memberId: null });
    const people = await db
      .select({ id: member.id, email: user.email, prefs: member.notifPrefs, guestId: mealGuest.id, status: mealGuest.status })
      .from(mealGuest)
      .innerJoin(member, eq(member.id, mealGuest.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(mealGuest.eventId, meal.id));
    for (const p of people.filter((x) => x.status !== "no")) {
      const mine = view.items.flatMap((i) => i.claims.filter((c) => c.guestId === p.guestId).map((c) => (c.amount && c.amount !== "tout" ? `${i.label} (${c.amount})` : i.label)));
      await notify(meal, p, "meal.reminder", `Demain : ${meal.title}`, [mine.length ? `Tu ramènes : ${mine.join(", ")}.` : "Tu n'as encore rien choisi à ramener : il est encore temps."], "Voir le repas");
      sent += 1;
    }
    await db.update(menuEvent).set({ reminderSentAt: new Date() }).where(eq(menuEvent.id, meal.id));
  }
  return sent;
}

/** « Partager les frais »: a Caisse event with the members who come (their +1 as extra shares). */
export async function openCaisse(meal: MenuEvent): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (meal.caisseEventId) return { ok: true, id: meal.caisseEventId };
  const guests = await db.select().from(mealGuest).where(and(eq(mealGuest.eventId, meal.id), eq(mealGuest.status, "yes")));
  const participants = guests.filter((g) => g.memberId).map((g) => ({ memberId: g.memberId!, shares: 1 + g.plusOnes }));
  if (!participants.some((p) => p.memberId === meal.createdById)) participants.push({ memberId: meal.createdById, shares: 1 });
  const event = await createExpenseEvent(meal.createdById, `${meal.title} (${new Date(`${meal.eventDate}T12:00:00`).toLocaleDateString("fr-FR")})`, participants);
  await db.update(menuEvent).set({ caisseEventId: event.id }).where(eq(menuEvent.id, meal.id));
  return { ok: true, id: event.id };
}

/** « Refaire ce repas »: same guests (no answers yet), same list (nobody on it yet), a new date. */
export async function duplicateMeal(meal: MenuEvent, date: string): Promise<MenuEvent> {
  const [row] = await db
    .insert(menuEvent)
    .values({ createdById: meal.createdById, title: meal.title, eventDate: date, time: meal.time, place: meal.place, description: meal.description, open: meal.open, template: meal.template, token: newToken() })
    .returning();
  if (!row) throw new Error("meal not duplicated");
  const guests = await db.select().from(mealGuest).where(eq(mealGuest.eventId, meal.id));
  if (guests.length) await db.insert(mealGuest).values(guests.map((g) => ({ eventId: row.id, memberId: g.memberId, name: g.name, vege: g.vege, status: g.memberId === meal.createdById ? "yes" : null })));
  const items = await db.select().from(mealItem).where(eq(mealItem.eventId, meal.id));
  if (items.length) await db.insert(mealItem).values(items.map((i) => ({ eventId: row.id, label: i.label, quantity: i.quantity, unit: i.unit, category: i.category, position: i.position })));
  return row;
}

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db/client";
import { santaDish, santaDrink, santaEvent, santaMeal, santaParticipant, santaPresence, type SantaEvent } from "@/core/db/schema";
import { asTheme } from "../themes";
import { DISH_CATEGORIES, DRINK_TYPES, DRINK_UNITS, MEAL_KINDS, daysBetween, type MealKind, type Presence } from "../domain/meals";
import type { MealsSettingsView, MealsView } from "../views";

export type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

export const MEAL_LIMITS = { what: 120, note: 300, diet: 200, mealsNote: 500, guests: 20, parts: 200, quantity: 999 };

/**
 * Who acts on the meals. A participant comes through their personal link and speaks for themselves;
 * an organizer comes through the panel and may fill in for anyone (`me` is their own participant, if any).
 */
export type MealsActor = { me: string | null; organizer: boolean };

/** An organizer on the meals: their own participant if they take part, and the right to fill in for anyone. */
export async function organizerMealsActor(event: SantaEvent, memberId: string): Promise<MealsActor> {
  const [me] = await db
    .select({ id: santaParticipant.id })
    .from(santaParticipant)
    .where(and(eq(santaParticipant.eventId, event.id), eq(santaParticipant.memberId, memberId)))
    .limit(1);
  return { me: me?.id ?? null, organizer: true };
}

const sortMeals = (a: { day: string; meal: string }, b: { day: string; meal: string }) =>
  a.day.localeCompare(b.day) || MEAL_KINDS.indexOf(a.meal as MealKind) - MEAL_KINDS.indexOf(b.meal as MealKind);

async function loadMeals(eventId: string) {
  const rows = await db.select().from(santaMeal).where(eq(santaMeal.eventId, eventId));
  return rows.sort(sortMeals);
}

/** The meals to show: switched on, inside the organizers' range. */
function shownMeals(event: SantaEvent, meals: (typeof santaMeal.$inferSelect)[]) {
  if (!event.mealsFrom || !event.mealsTo) return [];
  const days = new Set(daysBetween(event.mealsFrom, event.mealsTo));
  return meals.filter((m) => !m.off && days.has(m.day));
}

export async function getMealsSettings(event: SantaEvent): Promise<MealsSettingsView> {
  const days = event.mealsFrom && event.mealsTo ? new Set(daysBetween(event.mealsFrom, event.mealsTo)) : new Set<string>();
  const all = await loadMeals(event.id);
  const ids = all.map((m) => m.id);
  // What's written on each meal: a meal taken off, or a day left out, hides it from everyone (nothing is erased).
  const dishes = ids.length
    ? await db
        .select({ mealId: santaDish.mealId, what: santaDish.what, who: santaParticipant.name })
        .from(santaDish)
        .innerJoin(santaParticipant, eq(santaParticipant.id, santaDish.participantId))
        .where(inArray(santaDish.mealId, ids))
        .orderBy(asc(santaDish.createdAt))
    : [];
  const answers = ids.length ? await db.select({ mealId: santaPresence.mealId }).from(santaPresence).where(inArray(santaPresence.mealId, ids)) : [];
  const count = (mealId: string) => ({ dishes: dishes.filter((d) => d.mealId === mealId).length, answers: answers.filter((a) => a.mealId === mealId).length });
  return {
    enabled: event.mealsEnabled,
    from: event.mealsFrom,
    to: event.mealsTo,
    note: event.mealsNote,
    slots: all.filter((m) => days.has(m.day)).map((m) => ({ id: m.id, day: m.day, meal: m.meal as MealKind, off: m.off, ...count(m.id) })),
    hidden: all
      .filter((m) => m.off || !days.has(m.day))
      .map((m) => ({ id: m.id, day: m.day, meal: m.meal as MealKind, off: m.off, outOfRange: !days.has(m.day), answers: count(m.id).answers, dishes: dishes.filter((d) => d.mealId === m.id).map((d) => ({ who: d.who, what: d.what })) }))
      .filter((m) => m.dishes.length > 0 || m.answers > 0),
  };
}

/** Turning the meals on or off, and the range of days. Every day in range gets its two meals; days left out keep theirs, hidden. */
export async function updateMealsSettings(event: SantaEvent, s: { enabled: boolean; from: string | null; to: string | null; note: string }): Promise<Result> {
  if (event.archivedAt) return fail("Ce Secret Santa est terminé.");
  if (s.enabled && (!s.from || !s.to)) return fail("Choisis le premier et le dernier jour.");
  const days = s.from && s.to ? daysBetween(s.from, s.to) : [];
  if (s.from && s.to && days.length === 0) return fail("Ces dates ne vont pas : le dernier jour doit suivre le premier, deux semaines au plus.");
  await db
    .update(santaEvent)
    .set({ mealsEnabled: s.enabled, mealsFrom: s.from, mealsTo: s.to, mealsNote: s.note.trim().slice(0, MEAL_LIMITS.mealsNote) })
    .where(eq(santaEvent.id, event.id));
  const rows = days.flatMap((day) => MEAL_KINDS.map((meal) => ({ eventId: event.id, day, meal })));
  if (rows.length) await db.insert(santaMeal).values(rows).onConflictDoNothing();
  return { ok: true };
}

/** One meal on or off, say no dinner on the 25th. What was planned for it stays, hidden. */
export async function toggleMeal(event: SantaEvent, mealId: string): Promise<Result> {
  const [meal] = await db.select().from(santaMeal).where(and(eq(santaMeal.id, mealId), eq(santaMeal.eventId, event.id))).limit(1);
  if (!meal) return fail("Ce repas n'existe plus.");
  await db.update(santaMeal).set({ off: !meal.off }).where(eq(santaMeal.id, meal.id));
  return { ok: true };
}

export async function getMealsView(event: SantaEvent, actor: MealsActor): Promise<MealsView> {
  const meals = shownMeals(event, await loadMeals(event.id));
  const mealIds = meals.map((m) => m.id);
  const people = await db.select().from(santaParticipant).where(eq(santaParticipant.eventId, event.id)).orderBy(asc(santaParticipant.createdAt));
  const presence = mealIds.length ? await db.select().from(santaPresence).where(inArray(santaPresence.mealId, mealIds)) : [];
  const dishes = await db.select().from(santaDish).where(eq(santaDish.eventId, event.id)).orderBy(asc(santaDish.createdAt));
  const drinks = await db.select().from(santaDrink).where(eq(santaDrink.eventId, event.id)).orderBy(asc(santaDrink.createdAt));
  const shown = new Set(mealIds);
  // « Ce que j'ai noté »: every dish of the viewer's, even on a meal that's hidden for now.
  const allMeals = new Map((await loadMeals(event.id)).map((m) => [m.id, m]));
  const mine = actor.me
    ? dishes
        .filter((d) => d.participantId === actor.me || d.withId === actor.me)
        .flatMap((d) => {
          const m = allMeals.get(d.mealId);
          return m ? [{ id: d.id, day: m.day, meal: m.meal as MealKind, what: d.what, idea: d.idea, hidden: !shown.has(m.id) }] : [];
        })
        .sort((a, b) => sortMeals(a, b))
    : [];
  const days: MealsView["days"] = [];
  for (const m of meals) {
    const last = days.at(-1);
    if (last?.day === m.day) last.meals.push({ id: m.id, meal: m.meal as MealKind });
    else days.push({ day: m.day, meals: [{ id: m.id, meal: m.meal as MealKind }] });
  }
  return {
    title: event.title,
    theme: asTheme(event.theme),
    archived: !!event.archivedAt,
    note: event.mealsNote,
    days,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      diet: p.diet,
      guests: p.guests,
      presence: Object.fromEntries(presence.filter((x) => x.participantId === p.id).map((x) => [x.mealId, x.value as Presence])),
    })),
    dishes: dishes
      .filter((d) => shown.has(d.mealId))
      .map((d) => ({ id: d.id, mealId: d.mealId, who: d.participantId, withId: d.withId, what: d.what, category: d.category, parts: d.parts, veg: d.veg, note: d.note, idea: d.idea })),
    drinks: drinks.map((d) => ({ id: d.id, who: d.participantId, type: d.type, quantity: d.quantity, unit: d.unit, what: d.what })),
    mine,
    me: actor.me,
    organizer: actor.organizer,
  };
}

// ───────── What participants do (and organizers, for anyone) ─────────

/** Who an action is about: oneself, or anyone of the event for an organizer. */
async function subject(event: SantaEvent, actor: MealsActor, participantId: string | undefined): Promise<string | { error: string }> {
  if (event.archivedAt) return { error: "Ce Secret Santa est terminé : les repas ne bougent plus." };
  if (!event.mealsEnabled) return { error: "Les repas ne sont pas activés pour ce Secret Santa." };
  const id = participantId ?? actor.me;
  if (!id) return { error: "Choisis pour qui." };
  if (id !== actor.me && !actor.organizer) return { error: "Tu ne peux remplir que pour toi." };
  const [p] = await db.select({ id: santaParticipant.id }).from(santaParticipant).where(and(eq(santaParticipant.id, id), eq(santaParticipant.eventId, event.id))).limit(1);
  return p ? p.id : { error: "Cette personne ne participe pas." };
}

async function shownMeal(event: SantaEvent, mealId: string) {
  return shownMeals(event, await db.select().from(santaMeal).where(and(eq(santaMeal.id, mealId), eq(santaMeal.eventId, event.id)))).at(0) ?? null;
}

export async function setPresence(event: SantaEvent, actor: MealsActor, input: { participantId?: string; mealId: string; value: Presence | null }): Promise<Result> {
  const who = await subject(event, actor, input.participantId);
  if (typeof who !== "string") return fail(who.error);
  if (!(await shownMeal(event, input.mealId))) return fail("Ce repas n'est plus prévu.");
  if (input.value === null) {
    await db.delete(santaPresence).where(and(eq(santaPresence.mealId, input.mealId), eq(santaPresence.participantId, who)));
  } else {
    await db
      .insert(santaPresence)
      .values({ mealId: input.mealId, participantId: who, value: input.value })
      .onConflictDoUpdate({ target: [santaPresence.mealId, santaPresence.participantId], set: { value: input.value } });
  }
  return { ok: true };
}

export async function setProfile(event: SantaEvent, actor: MealsActor, input: { participantId?: string; diet: string; guests: number }): Promise<Result> {
  const who = await subject(event, actor, input.participantId);
  if (typeof who !== "string") return fail(who.error);
  const guests = Math.max(0, Math.min(MEAL_LIMITS.guests, Math.round(input.guests)));
  await db.update(santaParticipant).set({ diet: input.diet.trim().slice(0, MEAL_LIMITS.diet), guests }).where(eq(santaParticipant.id, who));
  return { ok: true };
}

export async function addDish(
  event: SantaEvent,
  actor: MealsActor,
  input: { participantId?: string; mealId: string; what: string; category: string; parts: number | null; veg: boolean; note: string; withId: string | null; idea: boolean },
): Promise<Result> {
  const who = await subject(event, actor, input.participantId);
  if (typeof who !== "string") return fail(who.error);
  if (!(await shownMeal(event, input.mealId))) return fail("Ce repas n'est plus prévu.");
  const what = input.what.trim().slice(0, MEAL_LIMITS.what);
  if (!what) return fail("Dis ce que c'est.");
  if (!(DISH_CATEGORIES as readonly string[]).includes(input.category)) return fail("Catégorie inconnue.");
  let withId = input.idea ? null : input.withId;
  if (withId === who) withId = null;
  if (withId) {
    const [partner] = await db.select({ id: santaParticipant.id }).from(santaParticipant).where(and(eq(santaParticipant.id, withId), eq(santaParticipant.eventId, event.id))).limit(1);
    if (!partner) withId = null;
  }
  const parts = input.idea || !input.parts ? null : Math.max(1, Math.min(MEAL_LIMITS.parts, Math.round(input.parts)));
  await db.insert(santaDish).values({
    eventId: event.id,
    mealId: input.mealId,
    participantId: who,
    withId,
    what,
    category: input.category,
    parts,
    veg: input.veg,
    note: input.idea ? "" : input.note.trim().slice(0, MEAL_LIMITS.note),
    idea: input.idea,
  });
  return { ok: true };
}

async function findDish(event: SantaEvent, id: string) {
  const [dish] = await db.select().from(santaDish).where(and(eq(santaDish.id, id), eq(santaDish.eventId, event.id))).limit(1);
  return dish ?? null;
}

/** Their own dish, or one they make with someone; organizers may take off any. */
export async function removeDish(event: SantaEvent, actor: MealsActor, id: string): Promise<Result> {
  if (event.archivedAt) return fail("Ce Secret Santa est terminé : les repas ne bougent plus.");
  const dish = await findDish(event, id);
  if (!dish) return { ok: true };
  const theirs = !!actor.me && (dish.participantId === actor.me || dish.withId === actor.me);
  if (!theirs && !actor.organizer) return fail("Seule la personne qui l'a proposé peut le retirer.");
  await db.delete(santaDish).where(eq(santaDish.id, dish.id));
  return { ok: true };
}

/** « Je m'en charge » : an idea becomes someone's dish. */
export async function takeIdea(event: SantaEvent, actor: MealsActor, input: { id: string; participantId?: string }): Promise<Result> {
  const who = await subject(event, actor, input.participantId);
  if (typeof who !== "string") return fail(who.error);
  const dish = await findDish(event, input.id);
  if (!dish?.idea) return fail("Quelqu'un s'en charge déjà.");
  await db.update(santaDish).set({ idea: false, participantId: who, withId: null }).where(and(eq(santaDish.id, dish.id), eq(santaDish.idea, true)));
  return { ok: true };
}

export async function addDrink(event: SantaEvent, actor: MealsActor, input: { participantId?: string; type: string; quantity: number; unit: string; what: string }): Promise<Result> {
  const who = await subject(event, actor, input.participantId);
  if (typeof who !== "string") return fail(who.error);
  if (!(DRINK_TYPES as readonly string[]).includes(input.type) || !(DRINK_UNITS as readonly string[]).includes(input.unit)) return fail("Boisson inconnue.");
  const quantity = Math.max(1, Math.min(MEAL_LIMITS.quantity, Math.round(input.quantity)));
  await db.insert(santaDrink).values({ eventId: event.id, participantId: who, type: input.type, quantity, unit: input.unit, what: input.what.trim().slice(0, MEAL_LIMITS.what) });
  return { ok: true };
}

export async function removeDrink(event: SantaEvent, actor: MealsActor, id: string): Promise<Result> {
  if (event.archivedAt) return fail("Ce Secret Santa est terminé : les repas ne bougent plus.");
  const [drink] = await db.select().from(santaDrink).where(and(eq(santaDrink.id, id), eq(santaDrink.eventId, event.id))).limit(1);
  if (!drink) return { ok: true };
  if (drink.participantId !== actor.me && !actor.organizer) return fail("Seule la personne qui l'apporte peut la retirer.");
  await db.delete(santaDrink).where(eq(santaDrink.id, drink.id));
  return { ok: true };
}

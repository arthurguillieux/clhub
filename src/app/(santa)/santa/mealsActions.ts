"use server";

import { z } from "zod";
import type { SantaEvent } from "@/core/db/schema";
import { findByToken } from "@/modules/santa/data/events";
import { MEAL_LIMITS, addDish, addDrink, getMealsView, organizerMealsActor, removeDish, removeDrink, setPresence, setProfile, takeIdea, type MealsActor } from "@/modules/santa/data/meals";
import { DISH_CATEGORIES, DRINK_TYPES, DRINK_UNITS } from "@/modules/santa/domain/meals";
import { checkOrganizer } from "@/modules/santa/host";
import type { MealsView } from "@/modules/santa/views";

const id = z.string().uuid();
const forWhom = id.optional();

const mealsActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("presence"), participantId: forWhom, mealId: id, value: z.enum(["x", "?"]).nullable() }),
  z.object({ type: z.literal("profile"), participantId: forWhom, diet: z.string().max(MEAL_LIMITS.diet, "C'est un peu long."), guests: z.number().int().min(0).max(MEAL_LIMITS.guests) }),
  z.object({
    type: z.literal("addDish"),
    participantId: forWhom,
    mealId: id,
    what: z.string().trim().min(1, "Dis ce que c'est.").max(MEAL_LIMITS.what, "Nom de plat trop long."),
    category: z.enum(DISH_CATEGORIES),
    parts: z.number().int().min(1).max(MEAL_LIMITS.parts).nullable(),
    veg: z.boolean(),
    note: z.string().max(MEAL_LIMITS.note, "Précision trop longue."),
    withId: id.nullable(),
    idea: z.boolean(),
  }),
  z.object({ type: z.literal("removeDish"), id }),
  z.object({ type: z.literal("takeIdea"), id, participantId: forWhom }),
  z.object({
    type: z.literal("addDrink"),
    participantId: forWhom,
    drink: z.enum(DRINK_TYPES),
    quantity: z.number().int().min(1).max(MEAL_LIMITS.quantity),
    unit: z.enum(DRINK_UNITS),
    what: z.string().max(MEAL_LIMITS.what, "Précision trop longue."),
  }),
  z.object({ type: z.literal("removeDrink"), id }),
]);

export type MealsResult = { ok: true; view: MealsView } | { ok: false; error: string };

async function run(event: SantaEvent, actor: MealsActor, action: unknown): Promise<MealsResult> {
  const parsed = mealsActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Action invalide." };
  const a = parsed.data;
  const result = await (() => {
    switch (a.type) {
      case "presence":
        return setPresence(event, actor, a);
      case "profile":
        return setProfile(event, actor, a);
      case "addDish":
        return addDish(event, actor, a);
      case "removeDish":
        return removeDish(event, actor, a.id);
      case "takeIdea":
        return takeIdea(event, actor, a);
      case "addDrink":
        return addDrink(event, actor, { participantId: a.participantId, type: a.drink, quantity: a.quantity, unit: a.unit, what: a.what });
      case "removeDrink":
        return removeDrink(event, actor, a.id);
    }
  })();
  if (!result.ok) return result;
  return { ok: true, view: await getMealsView(event, actor) };
}

/** From a participant's meals page: their secret link says who they are, and they speak for themselves. */
export async function santaMealsMeAction(token: string, action: unknown): Promise<MealsResult> {
  const found = await findByToken(token);
  if (!found) return { ok: false, error: "Lien inconnu." };
  return run(found.event, { me: found.me.id, organizer: false }, action);
}

export async function santaMealsOrgAction(code: string, action: unknown): Promise<MealsResult> {
  const check = await checkOrganizer(code);
  if (!check.ok) return { ok: false, error: "Tu n'organises pas ce Secret Santa." };
  return run(check.event, await organizerMealsActor(check.event, check.memberId), action);
}

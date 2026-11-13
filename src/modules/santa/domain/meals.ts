/**
 * « 🍽️ Les repas » of a Secret Santa: who's there for which meal, who brings what. Pure rules, so
 * the page and the tests count the same way.
 */

export const MEAL_KINDS = ["midi", "soir"] as const;
export type MealKind = (typeof MEAL_KINDS)[number];

export const DISH_CATEGORIES = ["Apéro", "Entrée", "Plat", "Fromage", "Dessert", "Autre"] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

export const DRINK_TYPES = ["Vin rouge", "Vin blanc", "Vin rosé", "Pétillant", "Champagne", "Bière", "Sodas", "Jus", "Eau", "Autre"] as const;
export const DRINK_UNITS = ["bouteilles", "L", "packs", "canettes", "sachets"] as const;

/** A stay is a few days, not a season: beyond this the organizers have mistyped a date. */
export const MAX_DAYS = 14;

export type Presence = "x" | "?";

/** Every day from `from` to `to`, both included, as YYYY-MM-DD; empty when the range is backwards or too long. */
export function daysBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const count = Math.round((end - start) / 86_400_000) + 1;
  if (count > MAX_DAYS) return [];
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

/** Who comes to a meal: sure, maybe, and how many haven't said. Each person counts with the guests they bring. */
export function headcount(people: { guests: number; presence: Record<string, Presence> }[], mealId: string): { sure: number; maybe: number; unanswered: number } {
  let sure = 0;
  let maybe = 0;
  let unanswered = 0;
  for (const p of people) {
    const value = p.presence[mealId];
    if (value === "x") sure += 1 + p.guests;
    else if (value === "?") maybe += 1 + p.guests;
    else unanswered += 1;
  }
  return { sure, maybe, unanswered };
}

/**
 * The portions announced for a meal, apéro and « autre » aside (oysters or leftovers don't feed a
 * table on their own count); `unknown` when a dish didn't say how many.
 */
export function portions(dishes: { category: string; parts: number | null; idea: boolean }[]): { parts: number; unknown: boolean } {
  const counted = dishes.filter((d) => !d.idea && d.category !== "Apéro" && d.category !== "Autre");
  return { parts: counted.reduce((n, d) => n + (d.parts ?? 0), 0), unknown: counted.some((d) => !d.parts) };
}

/** Totals per drink, adding up only the same units: 5 L and 4 bouteilles stay apart. */
export function drinkTotals(drinks: { type: string; quantity: number; unit: string }[]): { type: string; amounts: { unit: string; quantity: number }[] }[] {
  const byType = new Map<string, Map<string, number>>();
  for (const d of drinks) {
    const units = byType.get(d.type) ?? new Map<string, number>();
    units.set(d.unit, (units.get(d.unit) ?? 0) + d.quantity);
    byType.set(d.type, units);
  }
  const order = (type: string) => {
    const i = (DRINK_TYPES as readonly string[]).indexOf(type);
    return i === -1 ? DRINK_TYPES.length : i;
  };
  return [...byType.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([type, units]) => ({ type, amounts: [...units.entries()].map(([unit, quantity]) => ({ unit, quantity })) }));
}

/**
 * The New Year's arithmetic, pure: how many are coming (and for how long), how much of each thing
 * to buy, and each guest's part of the budget. No database here, only plain values.
 */

export type Rule = "fixed" | "person" | "person_day" | "person_meal";
export type Split = "presence" | "equal" | "options";
export type Answer = "pending" | "yes" | "maybe" | "no";

export const RULES: { id: Rule; label: string }[] = [
  { id: "person_day", label: "par personne et par jour" },
  { id: "person_meal", label: "par personne et par repas" },
  { id: "person", label: "par personne" },
  { id: "fixed", label: "en tout" },
];

/** Every date of the evening, first and last included: « 2026-12-31 » → « 2027-01-02 » is three days. */
export function eventDays(startsOn: string, endsOn: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${endsOn}T12:00:00Z`);
  for (let t = Date.parse(`${startsOn}T12:00:00Z`); t <= end && days.length < 31; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

export interface GuestPresence {
  answer: Answer;
  /** The dates they're there; null: all of them. */
  days: string[] | null;
}

/** The days a guest is there, within the evening's (at least one: someone who comes is there). */
export function daysOf(g: Pick<GuestPresence, "days">, all: string[]): string[] {
  const mine = g.days ? all.filter((d) => g.days!.includes(d)) : all;
  return mine.length ? mine : all.slice(0, 1);
}

export interface Headcount {
  /** Those who said yes (or the organizers' own number). */
  people: number;
  /** Person × day, so that someone who comes one day only counts for one. */
  personDays: number;
  personMeals: number;
  days: number;
  meals: number;
  /** Whether `people` is the organizers' number rather than the answers. */
  overridden: boolean;
}

export function headcount(guests: GuestPresence[], all: string[], meals: { day: string }[], override: number | null): Headcount {
  if (override !== null && override > 0)
    return { people: override, personDays: override * all.length, personMeals: override * meals.length, days: all.length, meals: meals.length, overridden: true };
  const coming = guests.filter((g) => g.answer === "yes");
  let personDays = 0;
  let personMeals = 0;
  for (const g of coming) {
    const mine = daysOf(g, all);
    personDays += mine.length;
    personMeals += meals.filter((m) => mine.includes(m.day)).length;
  }
  return { people: coming.length, personDays, personMeals, days: all.length, meals: meals.length, overridden: false };
}

export interface ItemRule {
  rule: Rule;
  ratio: number;
  perPack: number;
  packPriceCents: number | null;
  stock: number;
  overridePacks: number | null;
}

export interface ItemNeed {
  /** What the headcount calls for, in units (bottles, cans…). */
  units: number;
  /** Minus what is already there. */
  toBuy: number;
  /** Whole packs for `toBuy`, before any adjustment. */
  computedPacks: number;
  /** What will be bought: the adjustment if any, else the computation. */
  packs: number;
  costCents: number | null;
}

const base = (rule: Rule, hc: Headcount) => (rule === "fixed" ? 1 : rule === "person" ? hc.people : rule === "person_day" ? hc.personDays : hc.personMeals);

export function itemNeed(item: ItemRule, hc: Headcount): ItemNeed {
  const units = Math.max(0, item.ratio) * base(item.rule, hc);
  const toBuy = Math.max(0, units - Math.max(0, item.stock));
  // A hair under a whole pack stays that pack (floating point: 3.5 × 6 is 20.999…).
  const computedPacks = toBuy <= 0 ? 0 : Math.ceil(toBuy / Math.max(1, item.perPack) - 1e-9);
  const packs = item.overridePacks ?? computedPacks;
  return { units, toBuy, computedPacks, packs, costCents: item.packPriceCents === null ? null : packs * item.packPriceCents };
}

/** « 3,5 par personne et par jour », « 2 en tout ». */
export function ruleSentence(rule: Rule, ratio: number): string {
  const n = ratio.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return `${n} ${RULES.find((r) => r.id === rule)?.label ?? ""}`.trim();
}

// ───────── The budget ─────────

export interface BudgetGuest {
  id: string;
  answer: Answer;
  days: string[] | null;
  optionId: string | null;
  receivedCents: number;
}

export interface BudgetLineInput {
  /** « cost:… » or « list:… », and « other » for the expenses tied to nothing. */
  key: string;
  label: string;
  estimateCents: number;
  split: Split;
}

export interface BudgetExpense {
  guestId: string;
  cents: number;
  /** The line it pays for; null: none in particular. */
  lineKey: string | null;
}

export interface BudgetLine extends BudgetLineInput {
  realCents: number | null;
  /** What is shared: the real expenses once there are some, the estimate before. */
  amountCents: number;
}

export interface GuestAccount {
  guestId: string;
  parts: Record<string, number>;
  dueCents: number;
  advancedCents: number;
  receivedCents: number;
  /** > 0: still to pay; < 0: the group owes them. */
  balanceCents: number;
}

export interface Budget {
  lines: BudgetLine[];
  accounts: GuestAccount[];
  totalCents: number;
  /** What the options bring in, against the lines paid through them. */
  options: { collectedCents: number; costCents: number } | null;
}

/** `total` split by weights, to the cent: the leftover cents go to the largest remainders, first ones first. */
export function splitByWeight(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (totalCents <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalCents * w) / sum);
  const parts = exact.map(Math.floor);
  let left = totalCents - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i]! += 1;
    left -= 1;
  }
  return parts;
}

/**
 * Everyone's part, as in the old spreadsheet: the place by each one's option, the food and drinks by
 * the days each one is there, the rest in equal parts — between those who said yes. A line with real
 * expenses shares them instead of its estimate. What someone advanced comes off what they owe.
 */
export function budget(input: { days: string[]; guests: BudgetGuest[]; options: { id: string; priceCents: number }[]; lines: BudgetLineInput[]; expenses: BudgetExpense[] }): Budget {
  const payers = input.guests.filter((g) => g.answer === "yes");
  const real = new Map<string, number>();
  for (const e of input.expenses) {
    const key = e.lineKey && input.lines.some((l) => l.key === e.lineKey) ? e.lineKey : "other";
    real.set(key, (real.get(key) ?? 0) + e.cents);
  }
  const lines: BudgetLine[] = input.lines.map((l) => ({ ...l, realCents: real.get(l.key) ?? null, amountCents: real.get(l.key) ?? l.estimateCents }));
  if (real.has("other")) lines.push({ key: "other", label: "Autres dépenses", estimateCents: 0, split: "equal", realCents: real.get("other")!, amountCents: real.get("other")! });

  const parts = new Map(payers.map((g) => [g.id, {} as Record<string, number>]));
  const optionPrice = new Map(input.options.map((o) => [o.id, o.priceCents]));
  const hasOptions = input.options.length > 0;
  // The options pay for the first line split by them; any other such line is shared equally.
  const optionLine = hasOptions ? lines.find((l) => l.split === "options") : undefined;
  for (const line of lines) {
    let shares: number[];
    if (line === optionLine) shares = payers.map((g) => (g.optionId ? (optionPrice.get(g.optionId) ?? 0) : 0));
    else if (line.split === "presence") shares = splitByWeight(line.amountCents, payers.map((g) => daysOf(g, input.days).length));
    else shares = splitByWeight(line.amountCents, payers.map(() => 1));
    payers.forEach((g, i) => {
      const p = parts.get(g.id)!;
      if (shares[i]) p[line.key] = shares[i]!;
    });
  }

  const advanced = new Map<string, number>();
  for (const e of input.expenses) advanced.set(e.guestId, (advanced.get(e.guestId) ?? 0) + e.cents);
  const accounts: GuestAccount[] = input.guests
    .filter((g) => parts.has(g.id) || advanced.has(g.id) || g.receivedCents > 0)
    .map((g) => {
      const p = parts.get(g.id) ?? {};
      const dueCents = Object.values(p).reduce((a, b) => a + b, 0);
      const advancedCents = advanced.get(g.id) ?? 0;
      return { guestId: g.id, parts: p, dueCents, advancedCents, receivedCents: g.receivedCents, balanceCents: dueCents - advancedCents - g.receivedCents };
    });
  return {
    lines,
    accounts,
    totalCents: lines.reduce((a, l) => a + l.amountCents, 0),
    options: optionLine ? { collectedCents: accounts.reduce((a, acc) => a + (acc.parts[optionLine.key] ?? 0), 0), costCents: optionLine.amountCents } : null,
  };
}

/**
 * « Qui ramène quoi »: how far each line is covered, what is still missing, the feast gauge, and how
 * to say an amount. Pure, shared by the server and the page.
 */

export type Category = "manger" | "boire" | "materiel";
export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "manger", label: "À manger", emoji: "🍽️" },
  { id: "boire", label: "À boire", emoji: "🍷" },
  { id: "materiel", label: "Le matériel", emoji: "🔧" },
];

export interface LineClaim {
  guestId: string;
  /** null: the whole line (or a line without an amount). */
  quantity: number | null;
}

export interface Line {
  quantity: number | null;
  claims: LineClaim[];
}

/** How much is promised, and whether the line is covered. A line without an amount is covered by any claim. */
export function coverage(line: Line): { promised: number; missing: number; covered: boolean } {
  if (line.quantity === null) return { promised: 0, missing: 0, covered: line.claims.length > 0 };
  if (line.claims.some((c) => c.quantity === null)) return { promised: line.quantity, missing: 0, covered: true };
  const promised = line.claims.reduce((s, c) => s + (c.quantity ?? 0), 0);
  const missing = Math.max(0, round2(line.quantity - promised));
  return { promised: round2(promised), missing, covered: missing <= 0 };
}

/** What « Je ramène tout » takes: the rest of the line (all of it if nobody took any). */
export function restOf(line: Line, guestId: string): number | null {
  if (line.quantity === null) return null;
  const others = line.claims.filter((c) => c.guestId !== guestId);
  if (others.some((c) => c.quantity === null)) return 0;
  return Math.max(0, round2(line.quantity - others.reduce((s, c) => s + (c.quantity ?? 0), 0)));
}

/** The feast gauge: the share of lines covered, 0 to 100. */
export function feast(lines: Line[]): number {
  if (lines.length === 0) return 0;
  return Math.round((lines.filter((l) => coverage(l).covered).length / lines.length) * 100);
}

/** « 1,2 kg », « 3 bouteilles », « 500 g ». */
export function amount(quantity: number | null, unit: string | null): string {
  if (quantity === null) return "";
  const n = quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (!unit) return n;
  const plural = quantity > 1 && !["g", "kg", "L", "cl", "ml"].includes(unit) && !/[sx]$/.test(unit) ? `${unit}s` : unit;
  return `${n} ${plural}`;
}

/** Reads « 1,5 », « 2 », « 0.5 » as a number; null when it isn't one. */
export function parseAmount(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** For whoever opens the meal and brings nothing yet: never the same twice in a row. */
export const EMPTY_HANDED = [
  "Tu comptes venir les mains dans les poches ?",
  "Le fromage ne va pas se ramener tout seul.",
  "Personne n'a jamais été invité deux fois pour ses mains vides.",
  "On a bien noté ton appétit. On attend ta contribution.",
  "Même un bocal de cornichons, ça compte.",
  "Venir les mains vides, c'est un art. Pas ce soir.",
  "La liste te regarde. Elle attend.",
];

export function emptyHanded(seed: number): string {
  return EMPTY_HANDED[Math.abs(Math.floor(seed)) % EMPTY_HANDED.length]!;
}

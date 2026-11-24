/**
 * Money, the French way, everywhere in the club: « 12,50 € » on screen, and amounts typed as people
 * type them (« 12,5 », « 12.50 », « 12 € », « 1 250 »). Stored as cents.
 */
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** « 12,50 € » (a minus sign for a negative amount). */
export function euros(cents: number): string {
  return `${cents < 0 ? "−" : ""}${EUR.format(Math.abs(cents) / 100)}`;
}

/** The value to prefill an amount field with: « 12,50 ». */
export function centsForInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** A typed amount as a number of euros (comma or dot, spaces and « € » allowed); NaN when it isn't one. */
export function typedEuros(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.replace(/[\s  €]/g, "").replace(",", ".");
  return s === "" ? value : Number(s);
}

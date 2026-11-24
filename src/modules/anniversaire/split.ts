/**
 * The price split in equal parts, to the cent: 50 € between 3 is 16,67 + 16,67 + 16,66 — the odd
 * cents go to the first ones, so the parts always add up to the price exactly.
 */
export function splitEqually(totalCents: number, people: number): number[] {
  if (people <= 0 || totalCents <= 0) return [];
  const base = Math.floor(totalCents / people);
  const extra = totalCents - base * people;
  return Array.from({ length: people }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Who owes what to the buyer. `payers` are the members who said « je participe », in a stable order;
 * the buyer's own part is theirs to keep (they paid the shop), so they owe nothing.
 */
export function sharesFor(totalCents: number, payers: string[], buyerId: string | null): { memberId: string; cents: number; owesBuyer: boolean }[] {
  const parts = splitEqually(totalCents, payers.length);
  return payers.map((memberId, i) => ({ memberId, cents: parts[i] ?? 0, owesBuyer: memberId !== buyerId }));
}

/**
 * The rules of « Ma lettre au Père Noël », on plain values: what a letter is called, how full a gift
 * or a cagnotte is, what can still be promised, what order the family reads the list in.
 */
import { de } from "@/modules/santa/words";

export const LIMITS = {
  childName: 30,
  words: 3000,
  advice: 1000,
  payNote: 300,
  thanks: 1500,
  giftTitle: 120,
  note: 300,
  url: 2000,
  name: 40,
  gifts: 80,
  copies: 20,
  /** What one browser can reserve on one letter: more is someone playing with the page. */
  offersPerVisitor: 40,
  /** 100 000 €: more is a typo. */
  maxCents: 10_000_000,
};

export type LetterStage = "preparation" | "shared" | "closed";

export const letterTitle = (childName: string, year: number) => `Lettre au Père Noël ${de(childName)} ${year}`;

export function stageOf(letter: { sharedAt: Date | null; closedAt: Date | null }): LetterStage {
  if (letter.closedAt) return "closed";
  return letter.sharedAt ? "shared" : "preparation";
}

export const STAGE_LABELS: Record<LetterStage, string> = {
  preparation: "en préparation",
  shared: "envoyée à la famille",
  closed: "réservations fermées",
};

export interface GiftRules {
  pot: boolean;
  /** null: as many people as want to. */
  copies: number | null;
  /** For a cagnotte, the amount to reach. */
  priceCents: number | null;
}

export type GiftProgress =
  | { kind: "gift"; taken: number; limit: number | null; full: boolean }
  | { kind: "pot"; totalCents: number; targetCents: number; remainingCents: number; percent: number; full: boolean };

/** How far a gift is from being taken, or a cagnotte from its amount. */
export function progressOf(gift: GiftRules, offers: { amountCents: number | null }[]): GiftProgress {
  if (gift.pot) {
    const targetCents = gift.priceCents ?? 0;
    const totalCents = offers.reduce((sum, o) => sum + (o.amountCents ?? 0), 0);
    const remainingCents = Math.max(0, targetCents - totalCents);
    const percent = targetCents > 0 ? Math.min(100, Math.floor((totalCents * 100) / targetCents)) : 0;
    return { kind: "pot", totalCents, targetCents, remainingCents, percent, full: targetCents > 0 && totalCents >= targetCents };
  }
  const limit = gift.copies;
  return { kind: "gift", taken: offers.length, limit, full: limit !== null && offers.length >= limit };
}

/** Why this promise can't be made; null when it can. The cagnotte closes at its amount: the last one only gives what's left. */
export function pledgeError(amountCents: number | null, remainingCents: number): string | null {
  if (amountCents === null || !Number.isInteger(amountCents) || amountCents < 100) return "Indiquez un montant d'au moins 1 €.";
  if (remainingCents <= 0) return "La cagnotte est déjà complète. Merci !";
  if (amountCents > remainingCents) return `Il ne manque plus que ${euros(remainingCents)} : vous pouvez promettre ce montant au plus.`;
  return null;
}

/** « 35 € », « 35,50 € ». */
export function euros(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** What someone types for an amount: « 35 », « 35,5 », « 35.50 € ». Null if it isn't one. */
export function parseEuros(text: string): number | null {
  const s = text.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= LIMITS.maxCents ? cents : null;
}

/** The order of the list: the child's favourites first, then as they were added. */
export function byWish<T extends { favorite: boolean; createdAt: Date }>(a: T, b: T): number {
  return Number(b.favorite) - Number(a.favorite) || a.createdAt.getTime() - b.createdAt.getTime();
}

/** The gifts worth putting on next year's letter: those nobody gave, nor promised anything for. */
export function untaken<T extends { id: string }>(gifts: T[], offers: { giftId: string }[]): T[] {
  const taken = new Set(offers.map((o) => o.giftId));
  return gifts.filter((g) => !taken.has(g.id));
}

export interface OfferEvent {
  type: "offer" | "withdraw";
  name: string;
  giftTitle: string;
  /** A part of a cagnotte; null for a gift. */
  amountCents: number | null;
}

/** What the organizers read in their notifications and mails. */
export function offerSentence(e: OfferEvent & { childName: string }): string {
  if (e.amountCents !== null) {
    return e.type === "offer"
      ? `${e.name} promet ${euros(e.amountCents)} pour la cagnotte « ${e.giftTitle} ».`
      : `${e.name} retire sa part de ${euros(e.amountCents)} pour la cagnotte « ${e.giftTitle} ».`;
  }
  return e.type === "offer" ? `${e.name} offre « ${e.giftTitle} » à ${e.childName}.` : `${e.name} n'offre plus « ${e.giftTitle} » : il est de nouveau libre.`;
}

/**
 * French spacing that holds: the space people type before « ! ? : ; » and inside quotes becomes a
 * narrow no-break one, so a line never starts with a lonely « ! ».
 */
export const frenchSpaces = (text: string) => text.replace(/ ([!?:;»])/g, " $1").replace(/« /g, "« ");

/** A first name as people type it: trimmed, single spaces. */
export const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

/** The shop's name for a link, « fnac.com » for https://www.fnac.com/a123. */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

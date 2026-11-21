/**
 * The deck: what Arthur's table usually plays with, suggested from the number of players, then
 * adjusted by hand. And the draw, when the CLHUB deals the cards instead of a real deck.
 */
import { ROLES, WOLF_CARDS, type RoleId } from "./roles";

export type Deck = Partial<Record<RoleId, number>>;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 30;

/** The core of five, then one card more per player: Arthur's own order (12 players = his usual deck). */
const CORE: RoleId[] = ["loup", "barbier", "salvateur", "sorciere", "ancien"];
const SMALLER: RoleId[] = ["loup", "sorciere", "salvateur", "ancien"];
const GROWTH: Record<number, RoleId> = {
  6: "enfant",
  7: "vv",
  8: "loup",
  9: "cupidon",
  10: "idiot",
  11: "juge",
  12: "servante",
  15: "loup",
  18: "infect",
};

/** The card that the n-th player brings (n > 5). */
const cardFor = (n: number): RoleId => GROWTH[n] ?? "villageois";

export function deckSize(deck: Deck): number {
  return Object.values(deck).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function wolfCount(deck: Deck): number {
  return WOLF_CARDS.reduce((sum, id) => sum + (deck[id] ?? 0), 0);
}

function add(deck: Deck, id: RoleId): Deck {
  return { ...deck, [id]: (deck[id] ?? 0) + 1 };
}

/**
 * The deck for this many players. With `plague` (« peste noire »), as many spare cards as there are
 * wolves: the next cards of the order, never a wolf, so that sometimes no wolf is drawn at all.
 */
export function suggestDeck(players: number, plague: boolean): Deck {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.floor(players)));
  let deck: Deck = {};
  for (const id of n < CORE.length ? SMALLER.slice(0, n) : CORE) deck = add(deck, id);
  for (let i = CORE.length + 1; i <= n; i++) deck = add(deck, cardFor(i));
  if (plague) {
    const spare = wolfCount(deck);
    for (let i = 1; i <= spare; i++) {
      const next = cardFor(n + i);
      deck = add(deck, WOLF_CARDS.includes(next) ? "villageois" : next);
    }
  }
  return deck;
}

/** The deck as a list, in the catalogue's order: wolves first, then the village. */
export function deckEntries(deck: Deck): { id: RoleId; count: number }[] {
  return ROLES.filter((r) => (deck[r.id] ?? 0) > 0).map((r) => ({ id: r.id, count: deck[r.id] ?? 0 }));
}

/** The cards dealt to the seats, in seat order; spare cards stay face down. `random` returns [0, 1). */
export function draw(deck: Deck, seats: number, random: () => number): RoleId[] {
  const cards = deckEntries(deck).flatMap((e) => Array<RoleId>(e.count).fill(e.id));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards.slice(0, seats);
}

/** Why this deck can't be played with this many players; null when it can. */
export function deckError(deck: Deck, players: number): string | null {
  if (players < MIN_PLAYERS) return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
  if (players > MAX_PLAYERS) return `${MAX_PLAYERS} joueurs au plus.`;
  const size = deckSize(deck);
  if (size < players) return `Il manque ${players - size === 1 ? "une carte" : `${players - size} cartes`} : une par joueur au moins.`;
  if (wolfCount(deck) === 0) return "Il faut au moins un loup-garou dans le deck.";
  return null;
}

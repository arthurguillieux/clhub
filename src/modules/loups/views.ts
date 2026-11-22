import type { Deck } from "./domain/deck";
import type { Seat, Tracker, Winner } from "./domain/game";

export type Status = "setup" | "dealing" | "playing" | "done";

/** The meneur's page: everything, roles included. */
export interface HostView {
  code: string;
  link: string;
  status: Status;
  dealMode: "cards" | "app";
  deck: Deck;
  plague: boolean;
  nightOrder: string[] | null;
  tracker: Tracker;
  seats: (Seat & { playerId: string; startRole: string | null; cause: string | null; claimed: boolean; seen: boolean })[];
  winner: Winner | null;
  blackPlague: boolean;
  canUndo: boolean;
  /** The rule of each card as this meneur words it. */
  rules: Record<string, string>;
  /** The meneur's own card pictures, by face (« verso » or a role id). */
  art: Record<string, string>;
  /** The last card shown to the room. */
  reveal: { seatId: string; at: number } | null;
}

/** A player's phone: the deck and its rules, and only their own card. */
export interface PlayerView {
  meneur: string;
  art: Record<string, string>;
  status: Status;
  dealMode: "cards" | "app";
  players: number;
  deck: { id: string; name: string; count: number; rule: string }[];
  seats: { id: string; name: string; claimed: boolean }[];
  me: { seatId: string; name: string; role: string | null; roleName: string; rule: string } | null;
  /** Once the game is over: who was who. */
  end: { winner: Winner; blackPlague: boolean; seats: { name: string; role: string; alive: boolean }[] } | null;
}

/** The room's screen (optional, on a projector): public facts only, and the cards the meneur reveals. */
export interface ScreenView {
  status: Status;
  dealMode: "cards" | "app";
  link: string;
  turn: number;
  night: boolean;
  startedAt: number | null;
  endedAt: number | null;
  /** Server time, to time the game. */
  now: number;
  seats: { id: string; name: string; alive: boolean; deathOrder: number | null; role: string | null; roleName: string | null }[];
  /** The cards still in play (the deck minus the dead whose card is known). */
  cardsLeft: { id: string; name: string; count: number }[];
  /** Cards still face down beyond the living players (peste noire). */
  spare: number;
  winner: Winner | null;
  art: Record<string, string>;
  reveal: { seatId: string; name: string; role: string; roleName: string; at: number } | null;
}

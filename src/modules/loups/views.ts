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
}

/** A player's phone: the deck and its rules, and only their own card. */
export interface PlayerView {
  meneur: string;
  status: Status;
  dealMode: "cards" | "app";
  players: number;
  deck: { id: string; name: string; count: number; rule: string }[];
  seats: { id: string; name: string; claimed: boolean }[];
  me: { seatId: string; name: string; role: string | null; roleName: string; rule: string } | null;
  /** Once the game is over: who was who. */
  end: { winner: Winner; blackPlague: boolean; seats: { name: string; role: string; alive: boolean }[] } | null;
}

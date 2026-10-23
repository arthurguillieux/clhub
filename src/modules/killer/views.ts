import type { EndStats } from "./domain/circle";

/**
 * What each screen is allowed to know. The TV and the join screen get the
 * public view (no missions, no targets, no killers until the end); a phone gets
 * its own target and mission on top; only the organizer sees everything.
 */
export type GameStatus = "lobby" | "running" | "ended";

export interface PublicTribute {
  id: string;
  name: string;
  joined: boolean;
  photoVersion: number | null;
  alive: boolean;
  killedAt: string | null;
}

export interface PublicGameView {
  code: string;
  title: string;
  status: GameStatus;
  version: number;
  startedAt: string | null;
  endedAt: string | null;
  tributes: PublicTribute[];
  aliveCount: number;
  /** The most recent fall, so the TV can play the cannon once per death. */
  lastFall: { id: string; name: string; at: string; photoVersion: number | null } | null;
  falls: number;
  /** Set when the organizer chose their own elimination sound (its version, to reload it on change). */
  soundVersion: number | null;
  /** Only once the game is over — it names who killed whom. */
  stats: EndStats | null;
}

export interface PlayerGameView extends PublicGameView {
  me: {
    id: string;
    name: string;
    alive: boolean;
    hasPhoto: boolean;
    target: { id: string; name: string; photoVersion: number | null } | null;
    /** The mission attached to the current target. */
    mission: string | null;
  };
}

export interface HostTribute extends PublicTribute {
  mission: string;
  position: number;
  targetId: string | null;
  killedById: string | null;
}

export interface HostGameView extends Omit<PublicGameView, "tributes"> {
  tributes: HostTribute[];
  circle: string[];
  canUndo: boolean;
  /** Members the creator lets run the game with them. */
  cohosts: { memberId: string; name: string }[];
}

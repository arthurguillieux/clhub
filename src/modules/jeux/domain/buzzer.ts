import { AVATARS, avatarById } from "./avatars";

/**
 * Pure rules of a buzzer game — no I/O, no clock, no randomness (ids are
 * handed in), so every transition is unit-testable. The room registry that
 * holds one of these per running game lives in data/buzzerRooms.ts.
 *
 * A game is a lobby (teams join) followed by rounds: the host opens the
 * buzzers, the first team to buzz locks everyone else out, the host rules
 * right (points, round over) or wrong (that team is out until the next
 * round, buzzers reopen for the others).
 */

export const MAX_TEAMS = AVATARS.length;
export const MAX_NAME_LENGTH = 24;

export type Phase = "closed" | "open" | "buzzed";

export interface Team {
  id: string;
  /** Secret the team's phone sends with every request — never shown to anyone else. */
  token: string;
  name: string;
  score: number;
  avatarId: string;
  /** Wrong answer this round: can't buzz again until the host opens the next one. */
  out: boolean;
}

export interface BuzzerState {
  /** false = lobby (QR code), true = quiz running. */
  started: boolean;
  phase: Phase;
  winnerId: string | null;
  /** Bumped on every accepted buzz, so the host screen rings once per buzz. */
  buzzSeq: number;
  teams: Team[];
}

export function initialState(): BuzzerState {
  return { started: false, phase: "closed", winnerId: null, buzzSeq: 0, teams: [] };
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

// ───────── Joining ─────────

export interface JoinInput {
  name: string;
  /** Avatar the team wants; null = first free one. */
  avatarId: string | null;
  /** Token of an existing team (rename / change animal); null or unknown = new team. */
  token: string | null;
  /** Used only if a new team is created. */
  freshTeamId: string;
  freshToken: string;
}

export type JoinResult = { ok: true; state: BuzzerState; team: Team } | { ok: false; error: string };

export function joinTeam(state: BuzzerState, input: JoinInput): JoinResult {
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Écris un nom" };

  const existing = input.token ? state.teams.find((t) => t.token === input.token) : undefined;

  const wanted = input.avatarId ? avatarById(input.avatarId) : null;
  if (input.avatarId && !wanted) return { ok: false, error: "Animal inconnu" };
  if (wanted && state.teams.some((t) => t !== existing && t.avatarId === wanted.id)) {
    return { ok: false, error: "Cet animal vient d'être pris, choisis-en un autre" };
  }

  if (existing) {
    const team: Team = { ...existing, name, avatarId: wanted?.id ?? existing.avatarId };
    return { ok: true, state: { ...state, teams: state.teams.map((t) => (t === existing ? team : t)) }, team };
  }

  if (state.teams.length >= MAX_TEAMS) return { ok: false, error: `Déjà ${MAX_TEAMS} équipes` };
  const chosen = wanted ?? AVATARS.find((a) => !state.teams.some((t) => t.avatarId === a.id));
  if (!chosen) return { ok: false, error: `Déjà ${MAX_TEAMS} équipes` };

  const team: Team = { id: input.freshTeamId, token: input.freshToken, name, score: 0, avatarId: chosen.id, out: false };
  return { ok: true, state: { ...state, teams: [...state.teams, team] }, team };
}

// ───────── Buzzing ─────────

export type BuzzResult =
  | { kind: "unknown-team" }
  /** Buzzers closed, someone already buzzed, or this team is out — nothing changes. */
  | { kind: "ignored"; state: BuzzerState }
  | { kind: "buzzed"; state: BuzzerState };

export function buzz(state: BuzzerState, token: string): BuzzResult {
  const team = state.teams.find((t) => t.token === token);
  if (!team) return { kind: "unknown-team" };
  if (state.phase !== "open" || team.out) return { kind: "ignored", state };
  return { kind: "buzzed", state: { ...state, phase: "buzzed", winnerId: team.id, buzzSeq: state.buzzSeq + 1 } };
}

// ───────── Host controls ─────────

export type HostAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "cancel" }
  | { type: "correct"; points: number }
  | { type: "wrong" }
  | { type: "score"; teamId: string; delta: number }
  | { type: "rename"; teamId: string; name: string }
  | { type: "remove"; teamId: string }
  | { type: "start" }
  | { type: "lobby" }
  | { type: "resetAll" };

const mapTeam = (state: BuzzerState, teamId: string, fn: (t: Team) => Team): BuzzerState => ({
  ...state,
  teams: state.teams.map((t) => (t.id === teamId ? fn(t) : t)),
});

export function applyHostAction(state: BuzzerState, action: HostAction): BuzzerState {
  switch (action.type) {
    // New round: everyone is back in.
    case "open":
      return { ...state, teams: state.teams.map((t) => ({ ...t, out: false })), winnerId: null, phase: "open" };

    case "close":
      return { ...state, winnerId: null, phase: "closed" };

    // Cancels a buzz without penalty (e.g. a mis-tap): the round stays open.
    case "cancel":
      if (state.phase !== "buzzed") return state;
      return { ...state, winnerId: null, phase: "open" };

    case "correct": {
      if (state.phase !== "buzzed" || !state.winnerId) return state;
      const next = mapTeam(state, state.winnerId, (t) => ({ ...t, score: t.score + action.points }));
      return { ...next, winnerId: null, phase: "closed" };
    }

    case "wrong": {
      if (state.phase !== "buzzed" || !state.winnerId) return state;
      const next = mapTeam(state, state.winnerId, (t) => ({ ...t, out: true }));
      const everyoneOut = next.teams.every((t) => t.out);
      return { ...next, winnerId: null, phase: everyoneOut ? "closed" : "open" };
    }

    case "score":
      return mapTeam(state, action.teamId, (t) => ({ ...t, score: t.score + action.delta }));

    case "rename": {
      const name = cleanName(action.name);
      if (!name) return state;
      return mapTeam(state, action.teamId, (t) => ({ ...t, name }));
    }

    case "remove": {
      const removed = state.teams.find((t) => t.id === action.teamId);
      if (!removed) return state;
      const next = { ...state, teams: state.teams.filter((t) => t !== removed) };
      // Removing the team that was mid-buzz hands the round back to the others.
      return state.winnerId === removed.id ? { ...next, winnerId: null, phase: "open" } : next;
    }

    case "start":
      return { ...state, started: true, winnerId: null, phase: "closed" };

    case "lobby":
      return { ...state, started: false, winnerId: null, phase: "closed" };

    case "resetAll":
      return {
        ...state,
        teams: state.teams.map((t) => ({ ...t, score: 0, out: false })),
        winnerId: null,
        phase: "closed",
      };
  }
}

// ───────── What clients get to see ─────────

export interface TeamView {
  id: string;
  name: string;
  score: number;
  avatarId: string;
  color: string;
  out: boolean;
  online: boolean;
}

/** Public snapshot of a room — tokens are deliberately left out. */
export interface BuzzerView {
  code: string;
  version: number;
  ended: boolean;
  started: boolean;
  phase: Phase;
  winnerId: string | null;
  buzzSeq: number;
  teams: TeamView[];
}

export function toView(
  state: BuzzerState,
  meta: { code: string; version: number; ended: boolean },
  isOnline: (token: string) => boolean,
): BuzzerView {
  return {
    ...meta,
    started: state.started,
    phase: state.phase,
    winnerId: state.winnerId,
    buzzSeq: state.buzzSeq,
    teams: state.teams.map((t) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      avatarId: t.avatarId,
      color: avatarById(t.avatarId)?.color ?? "#9a9ab0",
      out: t.out,
      online: isOnline(t.token),
    })),
  };
}

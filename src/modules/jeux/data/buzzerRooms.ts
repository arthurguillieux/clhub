import { randomBytes, randomInt } from "node:crypto";
import {
  applyHostAction,
  buzz,
  initialState,
  joinTeam,
  toView,
  type BuzzerState,
  type BuzzerView,
  type HostAction,
} from "../domain/buzzer";

/**
 * Running buzzer games live in the server's memory, not in Postgres: "first
 * buzz wins" is trivially fair in a single Node process, nothing needs a
 * migration, and a game is over in an evening anyway. The catch is that a
 * redeploy (or a crash) ends every game in progress — see docs/04-exploitation.md.
 *
 * Phones can't hold a WebSocket/SSE stream open through every proxy (the
 * free Cloudflare tunnel used for the first version of this buzzer swallowed
 * SSE entirely), so they long-poll instead: a request stays open until the
 * room changes or POLL_TIMEOUT_MS passes, then the client immediately asks again.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1 — easy to read out loud
const CODE_LENGTH = 6;
const POLL_TIMEOUT_MS = 20_000;
/** A phone counts as online if it polled within this window — covers the gap between two long-polls. */
const ONLINE_GRACE_MS = 8_000;
const ROOM_IDLE_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_ROOMS = 50;
const MAX_WAITERS_PER_ROOM = 40;
const SWEEP_INTERVAL_MS = 3_000;

interface Waiter {
  token: string | null;
  release: (view: BuzzerView) => void;
}

export interface BuzzerRoom {
  code: string;
  hostMemberId: string;
  hostName: string;
  createdAt: number;
  lastActivityAt: number;
  state: BuzzerState;
  version: number;
  ended: boolean;
  lastSeen: Map<string, number>;
  waiters: Set<Waiter>;
  onlineSignature: string;
}

interface Registry {
  rooms: Map<string, BuzzerRoom>;
  sweeper: ReturnType<typeof setInterval> | null;
}

// On globalThis so every route bundle (and dev hot reloads) share one registry.
const holder = globalThis as typeof globalThis & { __clhubBuzzerRegistry?: Registry };
const registry: Registry = (holder.__clhubBuzzerRegistry ??= { rooms: new Map(), sweeper: null });

const rid = (bytes: number) => randomBytes(bytes).toString("hex");

function isOnline(room: BuzzerRoom, token: string): boolean {
  if ([...room.waiters].some((w) => w.token === token)) return true;
  return Date.now() - (room.lastSeen.get(token) ?? 0) < ONLINE_GRACE_MS;
}

export function viewOf(room: BuzzerRoom): BuzzerView {
  return toView(room.state, { code: room.code, version: room.version, ended: room.ended }, (token) =>
    isOnline(room, token),
  );
}

/** Wakes every pending long-poll with the new state. */
function notify(room: BuzzerRoom): void {
  room.version++;
  const view = viewOf(room);
  for (const waiter of [...room.waiters]) waiter.release(view);
}

const touch = (room: BuzzerRoom) => {
  room.lastActivityAt = Date.now();
};

const onlineSignature = (room: BuzzerRoom) => room.state.teams.map((t) => (isOnline(room, t.token) ? 1 : 0)).join("");

function sweep(): void {
  const now = Date.now();
  for (const room of [...registry.rooms.values()]) {
    if (now - room.lastActivityAt > ROOM_IDLE_TTL_MS && room.waiters.size === 0) {
      registry.rooms.delete(room.code);
      continue;
    }
    // A phone that went away just stops polling — nothing else tells the host, so check periodically.
    const signature = onlineSignature(room);
    if (signature !== room.onlineSignature) {
      room.onlineSignature = signature;
      notify(room);
    }
  }
}

function ensureSweeper(): void {
  if (registry.sweeper) return;
  registry.sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  registry.sweeper.unref?.();
}

export function createRoom(hostMemberId: string, hostName: string): BuzzerRoom {
  ensureSweeper();

  if (registry.rooms.size >= MAX_ROOMS) {
    // Drop the room nobody has touched for longest rather than refusing a new game.
    const oldest = [...registry.rooms.values()].sort((a, b) => a.lastActivityAt - b.lastActivityAt)[0];
    if (oldest) registry.rooms.delete(oldest.code);
  }

  let code = "";
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  } while (registry.rooms.has(code));

  const now = Date.now();
  const room: BuzzerRoom = {
    code,
    hostMemberId,
    hostName,
    createdAt: now,
    lastActivityAt: now,
    state: initialState(),
    version: 0,
    ended: false,
    lastSeen: new Map(),
    waiters: new Set(),
    onlineSignature: "",
  };
  registry.rooms.set(code, room);
  return room;
}

export function getRoom(code: string): BuzzerRoom | null {
  return registry.rooms.get(code.trim().toUpperCase()) ?? null;
}

export function listRoomsByHost(hostMemberId: string): BuzzerRoom[] {
  return [...registry.rooms.values()]
    .filter((r) => r.hostMemberId === hostMemberId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function hasTeam(room: BuzzerRoom, token: string): boolean {
  return room.state.teams.some((t) => t.token === token);
}

/**
 * Long-poll: answers right away if the caller is behind (`since` differs from
 * the room's version), otherwise holds the request until something changes.
 * `token` marks a team's phone as online; the host screen polls without one.
 */
export function longPoll(room: BuzzerRoom, token: string | null, since: number, signal?: AbortSignal): Promise<BuzzerView> {
  touch(room);
  if (token) {
    const wasOnline = isOnline(room, token);
    room.lastSeen.set(token, Date.now());
    if (!wasOnline) {
      room.onlineSignature = onlineSignature(room);
      notify(room);
    }
  }

  if (since !== room.version || room.waiters.size >= MAX_WAITERS_PER_ROOM) {
    return Promise.resolve(viewOf(room));
  }

  return new Promise((resolve) => {
    let finished = false;
    const waiter: Waiter = { token, release: (view) => finish(view) };
    const timer = setTimeout(() => finish(viewOf(room)), POLL_TIMEOUT_MS);

    function finish(view: BuzzerView) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      room.waiters.delete(waiter);
      if (token) room.lastSeen.set(token, Date.now());
      resolve(view);
    }

    signal?.addEventListener("abort", () => finish(viewOf(room)), { once: true });
    room.waiters.add(waiter);
  });
}

export type JoinOutcome = { ok: true; token: string; teamId: string } | { ok: false; error: string };

export function joinRoom(
  room: BuzzerRoom,
  input: { name: string; avatarId: string | null; token: string | null },
): JoinOutcome {
  const result = joinTeam(room.state, { ...input, freshTeamId: rid(8), freshToken: rid(16) });
  if (!result.ok) return result;
  room.state = result.state;
  room.lastSeen.set(result.team.token, Date.now());
  room.onlineSignature = onlineSignature(room);
  touch(room);
  notify(room);
  return { ok: true, token: result.team.token, teamId: result.team.id };
}

export type BuzzOutcome = "buzzed" | "ignored" | "unknown-team";

export function buzzRoom(room: BuzzerRoom, token: string): BuzzOutcome {
  const result = buzz(room.state, token);
  if (result.kind === "unknown-team") return "unknown-team";
  room.lastSeen.set(token, Date.now());
  if (result.kind === "ignored") return "ignored";
  room.state = result.state;
  touch(room);
  notify(room);
  return "buzzed";
}

export function applyHost(room: BuzzerRoom, action: HostAction): BuzzerView {
  room.state = applyHostAction(room.state, action);
  room.onlineSignature = onlineSignature(room);
  touch(room);
  notify(room);
  return viewOf(room);
}

/** Ends the game: connected phones get a final `ended` snapshot, then the room is gone. */
export function endRoom(room: BuzzerRoom): void {
  room.ended = true;
  notify(room);
  registry.rooms.delete(room.code);
}

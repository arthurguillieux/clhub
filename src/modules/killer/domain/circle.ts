/**
 * Pure rules of a Killer game: the circle of targets, eliminations (the killer
 * inherits the victim's target, and the mission travels with that target),
 * undo, late arrivals, end-of-game stats. No I/O, no clock, no randomness —
 * everything is passed in, so every case is unit-testable.
 */

export interface Tribute {
  id: string;
  name: string;
  position: number;
  targetId: string | null;
  alive: boolean;
  killedAt: Date | null;
  killedById: string | null;
}

export interface Patch {
  id: string;
  targetId?: string | null;
  alive?: boolean;
  killedAt?: Date | null;
  killedById?: string | null;
}

export interface Kill {
  victimId: string;
  killerId: string;
  inheritedTargetId: string;
}

/** Lobby order → circle: each tribute targets the next one, the last targets the first. */
export function buildCircle(tributes: Pick<Tribute, "id" | "position">[]): Patch[] {
  const ordered = [...tributes].sort((a, b) => a.position - b.position);
  if (ordered.length < 2) return [];
  return ordered.map((t, i) => ({ id: t.id, targetId: ordered[(i + 1) % ordered.length]!.id }));
}

/** Fisher–Yates with an injected random source (Math.random in production, a seed in tests). */
export function shuffledOrder<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** "Paul → Marie → Léa → Paul", read off the live targets, starting from the first alive tribute in lobby order. */
export function circleNames(tributes: Tribute[]): string[] {
  const alive = tributes.filter((t) => t.alive).sort((a, b) => a.position - b.position);
  const start = alive[0];
  if (!start) return [];
  const byId = new Map(tributes.map((t) => [t.id, t]));
  const names = [start.name];
  let current = byId.get(start.targetId ?? "");
  while (current && current.id !== start.id && names.length <= tributes.length) {
    names.push(current.name);
    current = byId.get(current.targetId ?? "");
  }
  names.push(start.name);
  return names;
}

export function findKiller(tributes: Tribute[], victimId: string): Tribute | null {
  return tributes.find((t) => t.alive && t.id !== victimId && t.targetId === victimId) ?? null;
}

export type EliminateResult =
  | { ok: true; patches: Patch[]; kill: Kill; finished: boolean }
  | { ok: false; error: string };

export function eliminate(tributes: Tribute[], victimId: string, now: Date): EliminateResult {
  const victim = tributes.find((t) => t.id === victimId);
  if (!victim) return { ok: false, error: "Agent introuvable." };
  if (!victim.alive) return { ok: false, error: `${victim.name} est déjà éliminé·e.` };
  const killer = findKiller(tributes, victimId);
  if (!killer || !victim.targetId) return { ok: false, error: `Personne n'a ${victim.name} pour cible.` };

  const inheritedTargetId = victim.targetId;
  const aliveAfter = tributes.filter((t) => t.alive && t.id !== victimId).length;
  return {
    ok: true,
    kill: { victimId, killerId: killer.id, inheritedTargetId },
    patches: [
      { id: victimId, alive: false, killedAt: now, killedById: killer.id },
      { id: killer.id, targetId: inheritedTargetId },
    ],
    finished: aliveAfter <= 1,
  };
}

/** Exact inverse of `eliminate` for the given kill. */
export function undoKill(kill: Kill): Patch[] {
  return [
    { id: kill.victimId, alive: true, killedAt: null, killedById: null },
    { id: kill.killerId, targetId: kill.victimId },
  ];
}

export type InsertResult = { ok: true; patches: Patch[] } | { ok: false; error: string };

/** A late arrival slots in right after a living tribute: they now hunt the newcomer, who takes over their old target. */
export function insertLate(tributes: Tribute[], newcomerId: string, afterId: string): InsertResult {
  const host = tributes.find((t) => t.id === afterId);
  if (!host || !host.alive || !host.targetId) return { ok: false, error: "Cet agent n'est plus en jeu." };
  return {
    ok: true,
    patches: [
      { id: newcomerId, targetId: host.targetId },
      { id: host.id, targetId: newcomerId },
    ],
  };
}

export interface EndStats {
  winner: { id: string; name: string } | null;
  podium: { id: string; name: string; kills: number }[];
  durationMinutes: number | null;
  firstFallen: { id: string; name: string; minutesIn: number } | null;
  lastFallen: { id: string; name: string } | null;
  fastestKill: { killerId: string; killerName: string; victimName: string; minutesIn: number } | null;
  totalKills: number;
}

const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));

export function endStats(tributes: Tribute[], startedAt: Date | null, endedAt: Date | null): EndStats {
  const byId = new Map(tributes.map((t) => [t.id, t]));
  const dead = tributes.filter((t) => !t.alive && t.killedAt).sort((a, b) => a.killedAt!.getTime() - b.killedAt!.getTime());
  const alive = tributes.filter((t) => t.alive);

  const killCounts = new Map<string, number>();
  for (const d of dead) if (d.killedById) killCounts.set(d.killedById, (killCounts.get(d.killedById) ?? 0) + 1);
  const podium = [...killCounts.entries()]
    .map(([id, kills]) => ({ id, name: byId.get(id)?.name ?? "?", kills }))
    .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name, "fr"))
    .slice(0, 3);

  const first = dead[0];
  const last = dead.at(-1);
  const fastest = first && first.killedById ? first : undefined;

  return {
    winner: alive.length === 1 ? { id: alive[0]!.id, name: alive[0]!.name } : null,
    podium,
    durationMinutes: startedAt && endedAt ? minutesBetween(startedAt, endedAt) : null,
    firstFallen: first && startedAt ? { id: first.id, name: first.name, minutesIn: minutesBetween(startedAt, first.killedAt!) } : null,
    lastFallen: last ? { id: last.id, name: last.name } : null,
    fastestKill:
      fastest && startedAt
        ? {
            killerId: fastest.killedById!,
            killerName: byId.get(fastest.killedById!)?.name ?? "?",
            victimName: fastest.name,
            minutesIn: minutesBetween(startedAt, fastest.killedAt!),
          }
        : null,
    totalKills: dead.length,
  };
}

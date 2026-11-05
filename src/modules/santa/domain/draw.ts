/**
 * The Secret Santa draw, as pure logic. Everyone gives to exactly one person and receives from
 * exactly one: an assignment givers → recipients, solved as a minimum-cost matching (Hungarian
 * algorithm) so that it always finds a draw when one exists, however many exclusions there are.
 *
 *  - Forbidden pairs (yourself, the exclusion rules) can't be chosen.
 *  - Pairs to avoid (last year's draw) cost dearly: they only come back if there's no other way,
 *    and as few as possible.
 *  - Random noise on every other pair makes each draw different; among several draws it keeps the
 *    one with the fewest A↔B swaps, which are less fun.
 */

export type Pair = readonly [giver: string, recipient: string];
export type ExclusionRule = { fromId: string; toId: string; mutual: boolean };

export type DrawResult =
  | { ok: true; pairs: Map<string, string>; repeats: number }
  /** `noRecipient`: can't draw anyone; `noGiver`: nobody can draw them. Both empty: impossible overall. */
  | { ok: false; noRecipient: string[]; noGiver: string[] };

const FORBIDDEN = 1e9;
const AVOID = 1000;
const ATTEMPTS = 40;
export const MIN_PARTICIPANTS = 3;

/** Every giver → recipient pair the rules forbid. */
export function forbiddenPairs(rules: ExclusionRule[]): Pair[] {
  return rules.flatMap((r): Pair[] => (r.mutual ? [[r.fromId, r.toId], [r.toId, r.fromId]] : [[r.fromId, r.toId]]));
}

/** Minimum-cost perfect matching on a square cost matrix: result[row] = column. */
function assign(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const match = new Array<number>(n + 1).fill(0); // match[column] = row, 1-based
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    match[0] = i;
    let j0 = 0;
    const minV = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = match[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const current = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (current < minV[j]!) {
          minV[j] = current;
          way[j] = j0;
        }
        if (minV[j]! < delta) {
          delta = minV[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[match[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minV[j]! -= delta;
        }
      }
      j0 = j1;
    } while (match[j0] !== 0);
    do {
      const j1 = way[j0]!;
      match[j0] = match[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }
  const result = new Array<number>(n).fill(0);
  for (let j = 1; j <= n; j++) result[match[j]! - 1] = j - 1;
  return result;
}

/** Runs the draw. `avoid` are soft: last year's pairs, only repeated when nothing else works. */
export function draw(ids: string[], forbidden: readonly Pair[], avoid: readonly Pair[] = [], random: () => number = Math.random): DrawResult {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const blocked = ids.map((_, i) => ids.map((_, j) => i === j));
  for (const [giver, recipient] of forbidden) {
    const i = index.get(giver);
    const j = index.get(recipient);
    if (i !== undefined && j !== undefined) blocked[i]![j] = true;
  }
  const soft = ids.map(() => ids.map(() => false));
  for (const [giver, recipient] of avoid) {
    const i = index.get(giver);
    const j = index.get(recipient);
    if (i !== undefined && j !== undefined) soft[i]![j] = true;
  }

  const failure = (): DrawResult => ({
    ok: false,
    noRecipient: ids.filter((_, i) => blocked[i]!.every(Boolean)),
    noGiver: ids.filter((_, j) => blocked.every((row) => row[j])),
  });
  if (n < 2) return failure();

  let best: { result: number[]; repeats: number; swaps: number } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const cost = ids.map((_, i) => ids.map((_, j) => (blocked[i]![j] ? FORBIDDEN : (soft[i]![j] ? AVOID : 0) + random())));
    const result = assign(cost);
    if (result.some((j, i) => blocked[i]![j])) return failure();
    const repeats = result.filter((j, i) => soft[i]![j]).length;
    const swaps = result.filter((j, i) => result[j] === i).length / 2;
    if (!best || repeats < best.repeats || (repeats === best.repeats && swaps < best.swaps)) best = { result, repeats, swaps };
    if (best.repeats === 0 && best.swaps === 0) break;
  }
  const { result, repeats } = best!;
  return { ok: true, pairs: new Map(result.map((j, i) => [ids[i]!, ids[j]!])), repeats };
}

/** « Noël 2026 » → « Noël 2027 »; without a year in the title, the coming one is added. */
export function nextYearTitle(title: string, currentYear: number): string {
  const withYear = title.replace(/\b(20\d\d)\b/, (year) => String(Number(year) + 1));
  return withYear !== title ? withYear : `${title} ${currentYear + 1}`;
}

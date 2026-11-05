/**
 * Snow settling on a surface, as a height per column. Pure, so it can be tested: WinterSnow.tsx only
 * draws what this computes. Each flake adds a small mound, and a mound too steep to hold slumps onto
 * its neighbours, which is what gives the piles their soft, uneven shape.
 */
export const COLUMN = 4;

/** The steepest step between two columns, in px, before the snow slides down. */
const REPOSE = 0.9;

export interface Pile {
  heights: Float32Array;
  /** How much each column can hold. */
  caps: Float32Array;
}

const columns = (width: number) => Math.max(2, Math.ceil(width / COLUMN) + 1);

/** A ledge holds the most in its middle and nothing at its very ends, where the snow would fall off. */
export function ledgeCaps(width: number, cap: number): Float32Array {
  const fade = Math.min(width / 2, 26);
  return Float32Array.from({ length: columns(width) }, (_, i) => {
    const edge = Math.min(1, Math.max(0, Math.min(i * COLUMN, width - i * COLUMN) / fade));
    return cap * edge * (2 - edge);
  });
}

/** Snow banks up in the corners of the window and stays low in the middle, over the page. */
export function driftCaps(width: number, cap: number): Float32Array {
  return Float32Array.from({ length: columns(width) }, (_, i) => {
    const fromCentre = Math.abs((i * COLUMN) / width - 0.5) * 2;
    return cap * (0.3 + 0.7 * fromCentre ** 2);
  });
}

/** A pile already `fill` full (0 to 1), in slow waves so it never starts as a ruled line. */
export function newPile(caps: Float32Array, fill: number, random: () => number): Pile {
  const a = random() * Math.PI * 2;
  const b = random() * Math.PI * 2;
  const heights = caps.map((cap, i) => cap * fill * (0.72 + 0.18 * Math.sin(i * 0.11 + a) + 0.1 * Math.sin(i * 0.31 + b)));
  return { heights, caps };
}

/** The same snow on a surface that changed size. */
export function resized(pile: Pile, caps: Float32Array): Pile {
  const last = pile.heights.length - 1;
  const heights = caps.map((cap, i) => {
    const at = (i / Math.max(1, caps.length - 1)) * last;
    const low = Math.floor(at);
    const high = Math.min(last, low + 1);
    return Math.min(cap, pile.heights[low]! + (pile.heights[high]! - pile.heights[low]!) * (at - low));
  });
  return { heights, caps };
}

/** Between two neighbouring columns, moves what's too steep onto the lower one. No snow is made or lost. */
function slide({ heights, caps }: Pile, a: number, b: number): boolean {
  const step = heights[a]! - heights[b]!;
  if (Math.abs(step) <= REPOSE) return false;
  const high = step > 0 ? a : b;
  const low = step > 0 ? b : a;
  const moved = Math.min((Math.abs(step) - REPOSE) / 2, caps[low]! - heights[low]!);
  if (moved <= 0) return false;
  heights[high]! -= moved;
  heights[low]! += moved;
  return true;
}

/** A flake lands on column `at`. */
export function land(pile: Pile, at: number, size: number, reach = 3): void {
  const { heights, caps } = pile;
  for (let d = -reach; d <= reach; d++) {
    const i = at + d;
    if (i < 0 || i >= heights.length) continue;
    heights[i] = Math.min(caps[i]!, heights[i]! + size * (1 - (d / (reach + 1)) ** 2));
  }
  // The slide runs outwards from the flake, for as long as the slope won't hold.
  for (let i = at; i < heights.length - 1; i++) if (!slide(pile, i, i + 1) && i >= at + reach) break;
  for (let i = at; i > 0; i--) if (!slide(pile, i, i - 1) && i <= at - reach) break;
}

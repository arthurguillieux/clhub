/**
 * How the TV's water drops move — no drawing here (see Bubbles.tsx), so it can run for hours in a
 * test. A drop has a place (u, v) on the room's front plane, in screen pixels, and a depth z
 * (0 = at the viewer, Z_MAX = well down the corridor); the screen shows it in the lab's perspective.
 */
export type Blob = {
  u: number;
  v: number;
  z: number;
  vu: number;
  vv: number;
  vz: number;
  /** The depth it tends to drift towards; picked anew every twenty seconds or so, usually near the front. */
  home: number;
  r: number;
  age: number;
  heading: number;
  cruise: number;
  /** Surface wobble: how much it stretches (decays back to a gentle idle), along an axis that turns slowly. */
  wobble: number;
  phase: number;
  speed: number;
  axis: number;
};

/** The screen, and the dice (seeded in tests). */
export type World = { width: number; height: number; random: () => number };

export const MIN_BLOBS = 9;
export const MAX_BLOBS = 15;
export const IDLE_WOBBLE = 0.05;

/**
 * The room's perspective, matching LabRoom (perspective 55vmax, depth 160vmax, vanishing point at
 * 50 % / 45 % of a stage 6 % larger than the screen): a drop at depth z is drawn at scale s(z).
 */
const PERSPECTIVE = 55;
const ROOM_DEPTH = 160;
export const Z_MAX = 0.7;
export const scaleAt = (z: number) => PERSPECTIVE / (PERSPECTIVE + z * ROOM_DEPTH);
const VANISH = { x: 0.5, y: -0.06 + 0.45 * 1.12 };

/**
 * Depth slices. Drops only merge with drops of their own slice — two drops far apart in depth that
 * happen to overlap on screen must not fuse — and a drop only moves to the next slice when nothing
 * is touching it, so no bridge between surfaces ever vanishes at once. Far slices are hazier.
 */
export const SLICES = [
  { from: 0, to: 0.1, haze: 1 },
  { from: 0.1, to: 0.28, haze: 0.85 },
  { from: 0.28, to: Z_MAX, haze: 0.68 },
];
export const sliceOf = (z: number) => {
  const index = SLICES.findIndex((s) => z < s.to);
  return index === -1 ? SLICES.length - 1 : index;
};

const unit = (w: World) => Math.min(w.width, w.height);
/** Cruising speeds, in px per frame on the front plane: ~25 to 55 px/s on a TV up close, never past twice the fastest. */
const cruiseMax = (w: World) => unit(w) * 0.0016;
/** Most drops stay towards the front, where they're big; some go all the way down the corridor. */
const pickDepth = (w: World) => Z_MAX * w.random() ** 3;

export function spawnBlob(w: World): Blob {
  const heading = w.random() * Math.PI * 2;
  const home = pickDepth(w);
  const r = unit(w) * (0.045 + w.random() * 0.05);
  // A little faster for small drops; perspective slows the far ones down on screen by itself.
  const cruise = unit(w) * (0.0004 + w.random() * 0.00035) * (0.07 / Math.max(0.045, r / unit(w)));
  return {
    u: w.random() * w.width,
    v: w.random() * w.height,
    z: home,
    home,
    vu: Math.cos(heading) * cruise,
    vv: Math.sin(heading) * cruise,
    vz: (w.random() - 0.5) * 0.0008,
    r,
    age: 0,
    heading,
    cruise,
    wobble: IDLE_WOBBLE,
    phase: w.random() * Math.PI * 2,
    speed: 0.025 + w.random() * 0.02,
    axis: w.random() * Math.PI,
  };
}

/** Where a drop is on screen, and how big it looks. */
export function project(b: Blob, w: World) {
  const s = scaleAt(b.z);
  const vx = VANISH.x * w.width;
  const vy = VANISH.y * w.height;
  return { x: vx + (b.u - vx) * s, y: vy + (b.v - vy) * s, r: b.r * s, s };
}

const touching = (a: Blob, b: Blob, w: World) => {
  const pa = project(a, w);
  const pb = project(b, w);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y) < (pa.r + pb.r) * 1.6;
};

const jiggle = (b: Blob, amount: number) => {
  b.wobble = Math.min(0.32, b.wobble + amount);
  b.axis = b.heading; // it stretches along the way it was thrown
};

/**
 * A drop gone wrong — a number that isn't one, or far off the screen — is replaced by a fresh one,
 * so nothing can ever empty the room, even after hours.
 */
const isSound = (b: Blob, w: World) =>
  [b.u, b.v, b.z, b.vu, b.vv, b.vz, b.r, b.cruise, b.heading].every(Number.isFinite) &&
  b.r > 0 &&
  b.u > -w.width &&
  b.u < 2 * w.width &&
  b.v > -w.height &&
  b.v < 2 * w.height;

/** One frame of movement: drift, wobble, merges, splits. Mutates `blobs`. */
export function stepBlobs(blobs: Blob[], w: World): void {
  if (w.width < 20 || w.height < 20) return; // a screen being resized or asleep: wait for a real size
  const maxCruise = cruiseMax(w);
  for (const b of blobs) {
    b.age++;
    // On the front plane: a cruising speed and a slowly wandering heading, turning back in near the edges.
    b.heading += (w.random() - 0.5) * 0.06;
    const margin = b.r * 0.6;
    if (b.u < margin || b.u > w.width - margin || b.v < margin || b.v > w.height - margin) {
      const toCentre = Math.atan2(w.height / 2 - b.v, w.width / 2 - b.u);
      b.heading += Math.sin(toCentre - b.heading) * 0.05;
    }
    b.cruise = Math.min(b.cruise, maxCruise);
    b.vu += (Math.cos(b.heading) * b.cruise - b.vu) * 0.02;
    b.vv += (Math.sin(b.heading) * b.cruise - b.vv) * 0.02;
    b.u += b.vu;
    b.v += b.vv;
    // In depth: a slow drift towards its preferred depth (half a minute or so from front to back), which
    // changes now and then — so drops travel the whole room while most of them stay near the front.
    if (w.random() < 0.0008) b.home = pickDepth(w);
    b.vz = Math.max(-0.0007, Math.min(0.0007, b.vz + (b.home - b.z) * 0.00002 + (w.random() - 0.5) * 0.00003));
    let z = b.z + b.vz;
    if (z < 0 || z > Z_MAX) {
      b.vz = -b.vz;
      z = Math.max(0, Math.min(Z_MAX, z));
    }
    // Crossing into another slice only when no drop of the current slice is touching this one.
    if (sliceOf(z) !== sliceOf(b.z) && blobs.some((o) => o !== b && sliceOf(o.z) === sliceOf(b.z) && touching(o, b, w))) {
      b.vz = -b.vz;
      z = b.z;
    }
    b.z = z;
    // The wobble: a slow oscillation that dies back down to the idle breathing.
    b.phase = (b.phase + b.speed) % (Math.PI * 2);
    b.axis = (b.axis + 0.002) % Math.PI;
    b.wobble = IDLE_WOBBLE + (b.wobble - IDLE_WOBBLE) * 0.993;
  }
  // Fusion: two drops of the same slice deep into each other (on screen and in depth) become one.
  // Keeping the sum of r² keeps the field — and so the drawn surface — the same as they merge.
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i]!;
      const b = blobs[j]!;
      if (blobs.length <= MIN_BLOBS || sliceOf(a.z) !== sliceOf(b.z) || Math.abs(a.z - b.z) > 0.06) continue;
      const pa = project(a, w);
      const pb = project(b, w);
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) >= Math.max(pa.r, pb.r) * 0.45) continue;
      const wa = a.r ** 2;
      const wb = b.r ** 2;
      const total = wa + wb;
      const along = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      a.u = (a.u * wa + b.u * wb) / total;
      a.v = (a.v * wa + b.v * wb) / total;
      a.z = (a.z * wa + b.z * wb) / total;
      a.vu = (a.vu * wa + b.vu * wb) / total;
      a.vv = (a.vv * wa + b.vv * wb) / total;
      a.heading = Math.atan2(a.vv, a.vu);
      a.cruise = Math.min(a.cruise, b.cruise);
      a.r = Math.sqrt(total);
      a.age = 0;
      jiggle(a, 0.18);
      a.axis = along; // still long in the direction the two came together
      a.phase = Math.PI / 2;
      blobs.splice(j, 1);
      j--;
    }
  }
  // Fission: now and then a big, settled drop pinches into two that drift apart, both quivering.
  if (blobs.length < MAX_BLOBS && w.random() < 0.005) {
    const big = blobs.filter((b) => b.r > unit(w) * 0.07 && b.age > 480);
    const parent = big[Math.floor(w.random() * big.length)];
    if (parent) {
      const r = parent.r / Math.SQRT2; // same sum of r², so the split starts seamlessly
      const angle = w.random() * Math.PI * 2;
      const push = parent.cruise * 2.5;
      // Each half a little quicker than the drop it came from — but merges only ever keep the slower
      // speed, so without this cap speeds could only climb over a long evening.
      const cruise = Math.min(parent.cruise * 1.2, maxCruise);
      const child: Blob = {
        ...parent,
        vu: parent.vu - Math.cos(angle) * push,
        vv: parent.vv - Math.sin(angle) * push,
        r,
        age: 0,
        heading: angle + Math.PI,
        cruise,
        phase: parent.phase + Math.PI,
      };
      parent.r = r;
      parent.vu += Math.cos(angle) * push;
      parent.vv += Math.sin(angle) * push;
      parent.heading = angle;
      parent.cruise = cruise;
      parent.age = 0;
      jiggle(parent, 0.2);
      jiggle(child, 0.2);
      blobs.push(child);
    }
  }
  for (let i = 0; i < blobs.length; i++) if (!isSound(blobs[i]!, w)) blobs[i] = spawnBlob(w);
  while (blobs.length < MIN_BLOBS) blobs.push(spawnBlob(w));
}

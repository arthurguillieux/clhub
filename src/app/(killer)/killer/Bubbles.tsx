"use client";

import { useEffect, useRef } from "react";

/**
 * A drop of water floating in the lab. (u, v) is its place on the room's front plane, in screen
 * pixels, and z how deep into the room it is (0 = at the viewer, Z_MAX = well down the corridor);
 * what the screen shows is that point seen in perspective.
 */
type Blob = {
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

/** Field resolution near the viewer: about this many computed points across the screen (lowered on a slow machine). */
const FIELD_WIDTHS = [320, 320, 220];
const MIN_BLOBS = 9;
const MAX_BLOBS = 15;
const SURFACE = 1;
const IDLE_WOBBLE = 0.05;
/** Where the light comes from (up and to the left), as a unit vector in screen space. */
const LIGHT = { x: -0.6, y: -0.8 };

/**
 * The room's perspective, matching LabRoom (perspective 55vmax, depth 160vmax, vanishing point at
 * 50 % / 45 % of a stage 6 % larger than the screen): a drop at depth z is drawn at scale s(z).
 */
const PERSPECTIVE = 55;
const ROOM_DEPTH = 160;
const Z_MAX = 0.7;
const scaleAt = (z: number) => PERSPECTIVE / (PERSPECTIVE + z * ROOM_DEPTH);
/** Most drops stay towards the front, where they're big; some go all the way down the corridor. */
const pickDepth = () => Z_MAX * Math.random() ** 3;
const VANISH = { x: 0.5, y: -0.06 + 0.45 * 1.12 };
/**
 * Depth slices. Drops only merge with drops of their own slice — two drops far apart in depth that
 * happen to overlap on screen must not fuse — and a drop only moves to the next slice when nothing
 * is touching it, so no bridge between surfaces ever vanishes at once. Far slices are hazier.
 */
const SLICES = [
  { from: 0, to: 0.1, haze: 1 },
  { from: 0.1, to: 0.28, haze: 0.85 },
  { from: 0.28, to: Z_MAX, haze: 0.68 },
];
const sliceOf = (z: number) => {
  const index = SLICES.findIndex((s) => z < s.to);
  return index === -1 ? SLICES.length - 1 : index;
};

/**
 * Traces the iso-line `level` of a sampled field (marching squares) within [x0, x1) × [y0, y1) as one
 * path of segments. Point (x, y) of the field sits at screen ((x + 0.5)·scale, (y + 0.5)·scale).
 */
function traceContour(
  ctx: CanvasRenderingContext2D,
  values: Float32Array,
  fw: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  level: number,
  scale: number,
) {
  const at = (x: number, y: number) => [(x + 0.5) * scale, (y + 0.5) * scale] as const;
  const cross = (p: number, q: number) => (level - p) / (q - p);
  ctx.beginPath();
  for (let y = box.y0; y < box.y1 - 1; y++) {
    for (let x = box.x0; x < box.x1 - 1; x++) {
      const i = y * fw + x;
      const a = values[i]!; // top left
      const b = values[i + 1]!; // top right
      const c = values[i + fw + 1]!; // bottom right
      const d = values[i + fw]!; // bottom left
      const index = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (index === 0 || index === 15) continue;
      const top = () => at(x + cross(a, b), y);
      const right = () => at(x + 1, y + cross(b, c));
      const bottom = () => at(x + cross(d, c), y + 1);
      const left = () => at(x, y + cross(a, d));
      const segment = (p: readonly [number, number], q: readonly [number, number]) => {
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      };
      switch (index) {
        case 1:
        case 14:
          segment(left(), bottom());
          break;
        case 2:
        case 13:
          segment(bottom(), right());
          break;
        case 3:
        case 12:
          segment(left(), right());
          break;
        case 4:
        case 11:
          segment(top(), right());
          break;
        case 6:
        case 9:
          segment(top(), bottom());
          break;
        case 7:
        case 8:
          segment(left(), top());
          break;
        case 5:
          segment(left(), top());
          segment(bottom(), right());
          break;
        case 10:
          segment(top(), right());
          segment(left(), bottom());
          break;
      }
    }
  }
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** One depth slice's field: its own buffer at its own resolution (finer for far, smaller drops). */
type SliceField = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData; values: Float32Array; scale: number };

/**
 * Water in zero gravity, like a lava lamp with nothing pulling: very transparent blue drops
 * drifting through the whole depth of the lab — far ones smaller, slower and hazier — merging when
 * they meet and now and then splitting in two. Each drop breathes (it stretches and relaxes along a
 * slowly turning axis) and jiggles after a merge or a split before settling. Drawn as metaballs
 * (every point sums r²/d², the surface is where the sum reaches 1), lit like a lens: the rim facing
 * the light goes pale, the far side deeper blue, with a soft membrane line and a small highlight.
 * Decorative; reduced motion gets one still frame.
 */
export function Bubbles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0; // in CSS pixels
    let height = 0;
    // Drawn at the screen's CSS resolution, not its device pixels: a Mac (×2) on a 4K TV would otherwise
    // push four times the pixels for drops that are soft anyway.
    const dpr = 1;
    // 0: redrawn every frame · 1: every other frame · 2: every other frame, coarser fields.
    let quality = 0;
    let fields: SliceField[] = [];

    const makeField = (scale: number): SliceField | null => {
      const fieldCanvas = document.createElement("canvas");
      fieldCanvas.width = Math.ceil(width / scale);
      fieldCanvas.height = Math.ceil(height / scale);
      const fieldCtx = fieldCanvas.getContext("2d");
      if (!fieldCtx) return null;
      return {
        canvas: fieldCanvas,
        ctx: fieldCtx,
        image: fieldCtx.createImageData(fieldCanvas.width, fieldCanvas.height),
        values: new Float32Array(fieldCanvas.width * fieldCanvas.height),
        scale,
      };
    };
    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const nearScale = Math.max(4, Math.ceil(width / FIELD_WIDTHS[quality]!));
      // Far drops are drawn smaller, so their slice is sampled more finely.
      fields = SLICES.map((s) => makeField(Math.max(2, Math.round(nearScale * scaleAt((s.from + s.to) / 2))))).filter(
        (f): f is SliceField => f !== null,
      );
    };
    resize();

    const unit = () => Math.min(width, height);
    const spawn = (): Blob => {
      const heading = Math.random() * Math.PI * 2;
      const home = pickDepth();
      const r = unit() * (0.045 + Math.random() * 0.05);
      // Cruising speed on the front plane, in px per frame, a little faster for small drops: ~25 to 55 px/s
      // on a TV up close; perspective slows the far ones down on screen by itself.
      const cruise = unit() * (0.0004 + Math.random() * 0.00035) * (0.07 / Math.max(0.045, r / unit()));
      return {
        u: Math.random() * width,
        v: Math.random() * height,
        z: home,
        home,
        vu: Math.cos(heading) * cruise,
        vv: Math.sin(heading) * cruise,
        vz: (Math.random() - 0.5) * 0.0008,
        r,
        age: 0,
        heading,
        cruise,
        wobble: IDLE_WOBBLE,
        phase: Math.random() * Math.PI * 2,
        speed: 0.025 + Math.random() * 0.02,
        axis: Math.random() * Math.PI,
      };
    };
    const blobs: Blob[] = Array.from({ length: 12 }, spawn);

    /** Where a drop is on screen, and how big it looks. */
    const project = (b: Blob) => {
      const s = scaleAt(b.z);
      const vx = VANISH.x * width;
      const vy = VANISH.y * height;
      return { x: vx + (b.u - vx) * s, y: vy + (b.v - vy) * s, r: b.r * s, s };
    };
    const touching = (a: Blob, b: Blob) => {
      const pa = project(a);
      const pb = project(b);
      return Math.hypot(pa.x - pb.x, pa.y - pb.y) < (pa.r + pb.r) * 1.6;
    };
    const jiggle = (b: Blob, amount: number) => {
      b.wobble = Math.min(0.32, b.wobble + amount);
      b.axis = b.heading; // it stretches along the way it was thrown
    };

    const step = () => {
      for (const b of blobs) {
        b.age++;
        // On the front plane: a cruising speed and a slowly wandering heading, turning back in near the edges.
        b.heading += (Math.random() - 0.5) * 0.06;
        const margin = b.r * 0.6;
        if (b.u < margin || b.u > width - margin || b.v < margin || b.v > height - margin) {
          const toCentre = Math.atan2(height / 2 - b.v, width / 2 - b.u);
          b.heading += Math.sin(toCentre - b.heading) * 0.05;
        }
        b.vu += (Math.cos(b.heading) * b.cruise - b.vu) * 0.02;
        b.vv += (Math.sin(b.heading) * b.cruise - b.vv) * 0.02;
        b.u += b.vu;
        b.v += b.vv;
        // In depth: a slow drift towards its preferred depth (half a minute or so from front to back), which
        // changes now and then — so drops travel the whole room while most of them stay near the front.
        if (Math.random() < 0.0008) b.home = pickDepth();
        b.vz = Math.max(-0.0007, Math.min(0.0007, b.vz + (b.home - b.z) * 0.00002 + (Math.random() - 0.5) * 0.00003));
        let z = b.z + b.vz;
        if (z < 0 || z > Z_MAX) {
          b.vz = -b.vz;
          z = Math.max(0, Math.min(Z_MAX, z));
        }
        // Crossing into another slice only when no drop of the current slice is touching this one.
        if (sliceOf(z) !== sliceOf(b.z) && blobs.some((o) => o !== b && sliceOf(o.z) === sliceOf(b.z) && touching(o, b))) {
          b.vz = -b.vz;
          z = b.z;
        }
        b.z = z;
        // The wobble: a slow oscillation that dies back down to the idle breathing.
        b.phase += b.speed;
        b.axis += 0.002;
        b.wobble = IDLE_WOBBLE + (b.wobble - IDLE_WOBBLE) * 0.993;
      }
      // Fusion: two drops of the same slice deep into each other (on screen and in depth) become one.
      // Keeping the sum of r² keeps the field — and so the drawn surface — the same as they merge.
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i]!;
          const b = blobs[j]!;
          if (blobs.length <= MIN_BLOBS || sliceOf(a.z) !== sliceOf(b.z) || Math.abs(a.z - b.z) > 0.06) continue;
          const pa = project(a);
          const pb = project(b);
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
      if (blobs.length < MAX_BLOBS && Math.random() < 0.005) {
        const big = blobs.filter((b) => b.r > unit() * 0.07 && b.age > 480);
        const parent = big[Math.floor(Math.random() * big.length)];
        if (parent) {
          const r = parent.r / Math.SQRT2; // same sum of r², so the split starts seamlessly
          const angle = Math.random() * Math.PI * 2;
          const push = parent.cruise * 2.5;
          const child: Blob = {
            ...parent,
            vu: parent.vu - Math.cos(angle) * push,
            vv: parent.vv - Math.sin(angle) * push,
            r,
            age: 0,
            heading: angle + Math.PI,
            cruise: parent.cruise * 1.2,
            phase: parent.phase + Math.PI,
          };
          parent.r = r;
          parent.vu += Math.cos(angle) * push;
          parent.vv += Math.sin(angle) * push;
          parent.heading = angle;
          parent.cruise *= 1.2;
          parent.age = 0;
          jiggle(parent, 0.2);
          jiggle(child, 0.2);
          blobs.push(child);
        }
      }
      if (blobs.length < MIN_BLOBS) blobs.push(spawn());
    };

    /** One slice: its field, computed only around its own drops, then fill, membrane and highlights. */
    const drawSlice = (sliceIndex: number, members: Blob[]) => {
      const field = fields[sliceIndex];
      if (!field || members.length === 0) return;
      const { image, values, scale } = field;
      const data = image.data;
      const fw = field.canvas.width;
      const fh = field.canvas.height;
      const haze = SLICES[sliceIndex]!.haze;

      // Per drop: centre and radius in field units, and its stretch — s along the axis, 1/s across it
      // (the same area, so a drop never seems to gain or lose water as it wobbles).
      const shapes = members.map((b) => {
        const p = project(b);
        const stretch = 1 + b.wobble * Math.sin(b.phase);
        return {
          x: p.x / scale - 0.5,
          y: p.y / scale - 0.5,
          rf: p.r / scale,
          r2: (p.r / scale) ** 2,
          cos: Math.cos(b.axis),
          sin: Math.sin(b.axis),
          along: 1 / (stretch * stretch),
          across: stretch * stretch,
        };
      });
      const reach = (s: (typeof shapes)[number]) => s.rf * 2.6;
      const box = {
        x0: Math.max(0, Math.floor(Math.min(...shapes.map((s) => s.x - reach(s))))),
        y0: Math.max(0, Math.floor(Math.min(...shapes.map((s) => s.y - reach(s))))),
        x1: Math.min(fw, Math.ceil(Math.max(...shapes.map((s) => s.x + reach(s))))),
        y1: Math.min(fh, Math.ceil(Math.max(...shapes.map((s) => s.y + reach(s))))),
      };
      if (box.x1 - box.x0 < 2 || box.y1 - box.y0 < 2) return;

      for (let y = box.y0; y < box.y1; y++) {
        for (let x = box.x0; x < box.x1; x++) {
          let f = 0;
          for (const s of shapes) {
            const dx = x - s.x;
            const dy = y - s.y;
            const u = dx * s.cos + dy * s.sin;
            const v = dy * s.cos - dx * s.sin;
            f += s.r2 / (u * u * s.along + v * v * s.across + 0.01);
          }
          values[y * fw + x] = f;
        }
      }

      // Light it like a lens: the outward normal is the field's gradient, reversed.
      for (let y = box.y0; y < box.y1; y++) {
        for (let x = box.x0; x < box.x1; x++) {
          const k = (y * fw + x) * 4;
          const f = values[y * fw + x]!;
          const edge = smoothstep(0.86, 1.04, f);
          if (edge === 0) {
            data[k + 3] = 0;
            continue;
          }
          const gx = values[y * fw + Math.min(box.x1 - 1, x + 1)]! - values[y * fw + Math.max(box.x0, x - 1)]!;
          const gy = values[Math.min(box.y1 - 1, y + 1) * fw + x]! - values[Math.max(box.y0, y - 1) * fw + x]!;
          const length = Math.hypot(gx, gy) || 1;
          const facing = -(gx * LIGHT.x + gy * LIGHT.y) / length; // 1 = rim turned to the light, -1 = away
          const rim = Math.max(0, 1 - (f - SURFACE) / 0.75) ** 2; // strongest just inside the surface
          const shine = Math.max(0, facing) * rim;
          const shade = Math.max(0, -facing) * rim;
          data[k] = 105 + 140 * shine - 25 * shade;
          data[k + 1] = 185 + 65 * shine - 30 * shade;
          data[k + 2] = 228 + 27 * shine - 10 * shade;
          data[k + 3] = edge * haze * (0.05 + 0.13 * rim + 0.1 * shine + 0.06 * shade) * 255;
        }
      }
      const w = box.x1 - box.x0;
      const h = box.y1 - box.y0;
      field.ctx.putImageData(image, 0, 0, box.x0, box.y0, w, h);
      ctx.drawImage(field.canvas, box.x0, box.y0, w, h, box.x0 * scale, box.y0 * scale, w * scale, h * scale);

      // The membrane: two strokes of the same path — a wide faint glow, then the line — rather than
      // shadowBlur, which is among the slowest things a canvas can draw. Thinner for far drops.
      const thickness = Math.max(0.6, scaleAt((SLICES[sliceIndex]!.from + SLICES[sliceIndex]!.to) / 2));
      traceContour(ctx, values, fw, box, SURFACE, scale);
      ctx.strokeStyle = `rgba(95, 200, 235, ${0.1 * haze})`;
      ctx.lineWidth = 7 * thickness;
      ctx.stroke();
      ctx.strokeStyle = `rgba(110, 190, 230, ${0.26 * haze})`;
      ctx.lineWidth = 2.4 * thickness;
      ctx.stroke();

      // A small highlight where the ceiling lights catch each drop.
      for (const b of members) {
        const p = project(b);
        const hx = p.x - p.r * 0.38;
        const hy = p.y - p.r * 0.42;
        const radius = p.r * 0.24;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius);
        g.addColorStop(0, `rgba(255, 255, 255, ${0.5 * haze})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // The far end first, so nearer drops pass in front.
      for (let i = SLICES.length - 1; i >= 0; i--) {
        drawSlice(
          i,
          blobs.filter((b) => sliceOf(b.z) === i),
        );
      }
    };

    const onResize = () => {
      resize();
      if (still) draw();
    };
    window.addEventListener("resize", onResize);

    // Watch how smoothly frames actually arrive (not just this script's share): if this machine keeps
    // falling behind — frames slower than ~40 per second for a couple of seconds — step the quality down.
    // A hidden tab or a one-off hiccup doesn't count.
    let frame = 0;
    let tick = 0;
    let cost = 0;
    let last = 0;
    let slow = 0;
    const loop = (now: number) => {
      const interval = last ? now - last : 16;
      last = now;
      if (!document.hidden && interval < 250) {
        slow = interval > 25 || cost > 9 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 90 && quality < FIELD_WIDTHS.length - 1) {
          quality++;
          slow = 0;
          resize();
        }
      }
      step();
      if (quality === 0 || tick % 2 === 0) {
        const start = performance.now();
        draw();
        cost = cost * 0.9 + (performance.now() - start) * 0.1;
      }
      tick++;
      frame = requestAnimationFrame(loop);
    };
    if (still) draw();
    else frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}

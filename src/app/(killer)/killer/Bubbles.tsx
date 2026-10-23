"use client";

import { useEffect, useRef } from "react";

type Blob = {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

/** Field resolution: about this many computed points across the screen (lowered on a machine that can't keep up). */
const FIELD_WIDTHS = [320, 320, 220];
const MIN_BLOBS = 7;
const MAX_BLOBS = 13;
const SURFACE = 1;
/** A gentle stretch that never quite stops, as water in zero gravity never sits perfectly round. */
const IDLE_WOBBLE = 0.05;
/** Where the light comes from (up and to the left), as a unit vector in screen space. */
const LIGHT = { x: -0.6, y: -0.8 };

/**
 * Traces the iso-line `level` of a sampled field (marching squares) as one path of segments.
 * Point (x, y) of the field sits at screen ((x + 0.5)·scale, (y + 0.5)·scale).
 */
function traceContour(ctx: CanvasRenderingContext2D, values: Float32Array, fw: number, fh: number, level: number, scale: number) {
  const at = (x: number, y: number) => [(x + 0.5) * scale, (y + 0.5) * scale] as const;
  const cross = (p: number, q: number) => (level - p) / (q - p);
  ctx.beginPath();
  for (let y = 0; y < fh - 1; y++) {
    for (let x = 0; x < fw - 1; x++) {
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

/**
 * Water in zero gravity, like a lava lamp with nothing pulling: very transparent blue blobs
 * drifting through the lab, merging when they meet and now and then splitting in two. Each blob
 * breathes — it stretches and relaxes along a slowly turning axis — and jiggles for a while after
 * a merge or a split before settling, as a real drop does. Drawn as metaballs (every point sums
 * r²/d², the surface is where the sum reaches 1), lit like a lens: the rim facing the light goes
 * pale, the far side deeper blue, with a soft membrane line and a small highlight.
 * Decorative; reduced motion gets one still frame.
 */
export function Bubbles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const field = document.createElement("canvas");
    const fieldCtx = field.getContext("2d");
    if (!fieldCtx) return;

    let width = 0; // in CSS pixels
    let height = 0;
    let image: ImageData | null = null;
    let values = new Float32Array(0);
    let scale = 4; // screen pixels per computed point
    // Drawn at the screen's CSS resolution, not its device pixels: a Mac (×2) on a 4K TV would otherwise
    // push four times the pixels for bubbles that are soft anyway.
    const dpr = 1;
    // 0: redrawn every frame · 1: every other frame · 2: every other frame, coarser field.
    let quality = 0;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      scale = Math.max(4, Math.ceil(width / FIELD_WIDTHS[quality]!));
      field.width = Math.ceil(width / scale);
      field.height = Math.ceil(height / scale);
      image = fieldCtx.createImageData(field.width, field.height);
      values = new Float32Array(field.width * field.height);
    };
    resize();

    const unit = () => Math.min(width, height);
    const spawn = (): Blob => {
      const heading = Math.random() * Math.PI * 2;
      const r = unit() * (0.045 + Math.random() * 0.05);
      // Cruising speed in px per frame, a little faster for small bubbles: ~25 to 55 px/s on a TV.
      const cruise = unit() * (0.0004 + Math.random() * 0.00035) * (0.07 / Math.max(0.045, r / unit()));
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(heading) * cruise,
        vy: Math.sin(heading) * cruise,
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
    const blobs: Blob[] = Array.from({ length: 10 }, spawn);
    const jiggle = (b: Blob, amount: number) => {
      b.wobble = Math.min(0.32, b.wobble + amount);
      b.axis = b.heading; // it stretches along the way it was thrown
    };

    const step = () => {
      for (const b of blobs) {
        b.age++;
        // Each bubble keeps its cruising speed and slowly changes direction; near an edge it turns back in.
        b.heading += (Math.random() - 0.5) * 0.06;
        const margin = b.r * 0.6;
        if (b.x < margin || b.x > width - margin || b.y < margin || b.y > height - margin) {
          const toCentre = Math.atan2(height / 2 - b.y, width / 2 - b.x);
          b.heading += Math.sin(toCentre - b.heading) * 0.05;
        }
        b.vx += (Math.cos(b.heading) * b.cruise - b.vx) * 0.02;
        b.vy += (Math.sin(b.heading) * b.cruise - b.vy) * 0.02;
        b.x += b.vx;
        b.y += b.vy;
        // The wobble: a slow oscillation that dies back down to the idle breathing.
        b.phase += b.speed;
        b.axis += 0.002;
        b.wobble = IDLE_WOBBLE + (b.wobble - IDLE_WOBBLE) * 0.993;
      }
      // Fusion: two bubbles deep into each other become one. Keeping the sum of r² keeps the field —
      // and so the drawn surface — the same at the moment they merge; the new drop then jiggles.
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i]!;
          const b = blobs[j]!;
          if (blobs.length > MIN_BLOBS && Math.hypot(a.x - b.x, a.y - b.y) < Math.max(a.r, b.r) * 0.45) {
            const wa = a.r ** 2;
            const wb = b.r ** 2;
            const total = wa + wb;
            const along = Math.atan2(b.y - a.y, b.x - a.x);
            a.x = (a.x * wa + b.x * wb) / total;
            a.y = (a.y * wa + b.y * wb) / total;
            a.vx = (a.vx * wa + b.vx * wb) / total;
            a.vy = (a.vy * wa + b.vy * wb) / total;
            a.heading = Math.atan2(a.vy, a.vx);
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
      }
      // Fission: now and then a big, settled bubble pinches into two that drift apart, both quivering.
      if (blobs.length < MAX_BLOBS && Math.random() < 0.005) {
        const big = blobs.filter((b) => b.r > unit() * 0.07 && b.age > 480);
        const parent = big[Math.floor(Math.random() * big.length)];
        if (parent) {
          const r = parent.r / Math.SQRT2; // same sum of r², so the split starts seamlessly
          const angle = Math.random() * Math.PI * 2;
          const push = parent.cruise * 2.5;
          const child: Blob = {
            ...parent,
            vx: parent.vx - Math.cos(angle) * push,
            vy: parent.vy - Math.sin(angle) * push,
            r,
            age: 0,
            heading: angle + Math.PI,
            cruise: parent.cruise * 1.2,
            phase: parent.phase + Math.PI,
          };
          parent.r = r;
          parent.vx += Math.cos(angle) * push;
          parent.vy += Math.sin(angle) * push;
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

    const draw = () => {
      if (!image) return;
      const data = image.data;
      const fw = field.width;
      const fh = field.height;
      // Per bubble: centre and radius in field units, and its stretch — s along the axis, 1/s across it
      // (the same area, so a drop never seems to gain or lose water as it wobbles).
      const shapes = blobs.map((b) => {
        const s = 1 + b.wobble * Math.sin(b.phase);
        return {
          x: b.x / scale - 0.5,
          y: b.y / scale - 0.5,
          r2: (b.r / scale) ** 2,
          cos: Math.cos(b.axis),
          sin: Math.sin(b.axis),
          along: 1 / (s * s),
          across: s * s,
        };
      });
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          let f = 0;
          for (const b of shapes) {
            const dx = x - b.x;
            const dy = y - b.y;
            const u = dx * b.cos + dy * b.sin;
            const v = dy * b.cos - dx * b.sin;
            f += b.r2 / (u * u * b.along + v * v * b.across + 0.01);
          }
          values[y * fw + x] = f;
        }
      }

      // Light it like a lens: the outward normal is the field's gradient, reversed.
      let k = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++, k += 4) {
          const f = values[y * fw + x]!;
          const edge = smoothstep(0.86, 1.04, f);
          if (edge === 0) {
            data[k + 3] = 0;
            continue;
          }
          const gx = values[y * fw + Math.min(fw - 1, x + 1)]! - values[y * fw + Math.max(0, x - 1)]!;
          const gy = values[Math.min(fh - 1, y + 1) * fw + x]! - values[Math.max(0, y - 1) * fw + x]!;
          const length = Math.hypot(gx, gy) || 1;
          const facing = -(gx * LIGHT.x + gy * LIGHT.y) / length; // 1 = rim turned to the light, -1 = away
          const rim = Math.max(0, 1 - (f - SURFACE) / 0.75) ** 2; // strongest just inside the surface
          const shine = Math.max(0, facing) * rim;
          const shade = Math.max(0, -facing) * rim;
          data[k] = 105 + 140 * shine - 25 * shade;
          data[k + 1] = 185 + 65 * shine - 30 * shade;
          data[k + 2] = 228 + 27 * shine - 10 * shade;
          data[k + 3] = edge * (0.05 + 0.13 * rim + 0.1 * shine + 0.06 * shade) * 255;
        }
      }
      fieldCtx.putImageData(image, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(field, 0, 0, fw * scale, fh * scale);

      // The membrane: a soft line on the surface — defined, but blurred into the water.
      // Two strokes of the same path — a wide faint one for the glow, a thinner one for the line — rather
      // than shadowBlur, which is among the slowest things a canvas can draw.
      traceContour(ctx, values, fw, fh, SURFACE, scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(95, 200, 235, 0.1)";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = "rgba(110, 190, 230, 0.26)";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // A small highlight where the ceiling lights catch each drop.
      for (const b of blobs) {
        const hx = b.x - b.r * 0.38;
        const hy = b.y - b.r * 0.42;
        const radius = b.r * 0.24;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius);
        g.addColorStop(0, "rgba(255, 255, 255, 0.5)");
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, radius, 0, Math.PI * 2);
        ctx.fill();
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

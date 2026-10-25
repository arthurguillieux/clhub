"use client";

import { useEffect, useRef } from "react";
import { SLICES, project, scaleAt, sliceOf, spawnBlob, stepBlobs, type Blob, type World } from "./bubbleSim";

/** Field resolution near the viewer: about this many computed points across the screen (lowered on a slow machine). */
const FIELD_WIDTHS = [320, 320, 220];
const SURFACE = 1;
/** Where the light comes from (up and to the left), as a unit vector in screen space. */
const LIGHT = { x: -0.6, y: -0.8 };

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

    // The screen in CSS pixels, shared with the simulation.
    const world: World = { width: 0, height: 0, random: Math.random };
    // Drawn at the screen's CSS resolution, not its device pixels: a Mac (×2) on a 4K TV would otherwise
    // push four times the pixels for drops that are soft anyway.
    const dpr = 1;
    // 0: redrawn every frame · 1: every other frame · 2: every other frame, coarser fields.
    let quality = 0;
    let fields: SliceField[] = [];

    const makeField = (scale: number): SliceField | null => {
      const fieldCanvas = document.createElement("canvas");
      fieldCanvas.width = Math.max(1, Math.ceil(world.width / scale));
      fieldCanvas.height = Math.max(1, Math.ceil(world.height / scale));
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
      // A window going to zero for a moment (a display asleep, full screen switching, an HDMI hiccup):
      // keep the last real size rather than build empty fields.
      if (canvas.offsetWidth < 20 || canvas.offsetHeight < 20) return;
      world.width = canvas.offsetWidth;
      world.height = canvas.offsetHeight;
      canvas.width = world.width * dpr;
      canvas.height = world.height * dpr;
      const nearScale = Math.max(4, Math.ceil(world.width / FIELD_WIDTHS[quality]!));
      // Far drops are drawn smaller, so their slice is sampled more finely.
      fields = SLICES.map((s) => makeField(Math.max(2, Math.round(nearScale * scaleAt((s.from + s.to) / 2))))).filter(
        (f): f is SliceField => f !== null,
      );
    };
    resize();

    let blobs: Blob[] = Array.from({ length: 12 }, () => spawnBlob(world));

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
        const p = project(b, world);
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
        const p = project(b, world);
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
      ctx.clearRect(0, 0, world.width, world.height);
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
      try {
        stepBlobs(blobs, world);
        if (quality === 0 || tick % 2 === 0) {
          const start = performance.now();
          draw();
          cost = cost * 0.9 + (performance.now() - start) * 0.1;
        }
      } catch (error) {
        // Never let one bad frame stop the animation for the rest of the evening (it used to): start afresh.
        console.warn("Killer : bulles relancées après une erreur", error);
        blobs = Array.from({ length: 12 }, () => spawnBlob(world));
        resize();
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

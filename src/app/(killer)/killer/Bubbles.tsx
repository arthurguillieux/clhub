"use client";

import { useEffect, useRef } from "react";

type Blob = { x: number; y: number; vx: number; vy: number; r: number; age: number; heading: number; cruise: number };

/** Field resolution: about this many computed points across the screen. */
const FIELD_WIDTH = 320;
const MIN_BLOBS = 7;
const MAX_BLOBS = 13;
/** The surface of a bubble, and a second line inside it where the light refracts. */
const SURFACE = 1;
const INNER_LINE = 1.45;

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

/**
 * Water bubbles in zero gravity, like a lava lamp with nothing pulling them: very transparent
 * blue blobs drifting through the lab, merging when they meet and now and then splitting in two.
 * Drawn as metaballs — every point sums r²/d² over the bubbles, the surface is where that sum
 * reaches 1 — with a faint fill, a crisp membrane traced at full resolution, a refraction line
 * inside it and a small highlight, so they read as water without taking the eye.
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
    const dpr = devicePixelRatio;

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      scale = Math.max(4, Math.ceil(width / FIELD_WIDTH));
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
      return { x: Math.random() * width, y: Math.random() * height, vx: Math.cos(heading) * cruise, vy: Math.sin(heading) * cruise, r, age: 0, heading, cruise };
    };
    const blobs: Blob[] = Array.from({ length: 10 }, spawn);

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
      }
      // Fusion: two bubbles deep into each other become one. Keeping the sum of r² keeps the field —
      // and so the drawn surface — exactly the same at the moment they merge: no visible jump.
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const a = blobs[i]!;
          const b = blobs[j]!;
          if (blobs.length > MIN_BLOBS && Math.hypot(a.x - b.x, a.y - b.y) < Math.max(a.r, b.r) * 0.45) {
            const wa = a.r ** 2;
            const wb = b.r ** 2;
            const total = wa + wb;
            a.x = (a.x * wa + b.x * wb) / total;
            a.y = (a.y * wa + b.y * wb) / total;
            a.vx = (a.vx * wa + b.vx * wb) / total;
            a.vy = (a.vy * wa + b.vy * wb) / total;
            a.heading = Math.atan2(a.vy, a.vx);
            a.cruise = Math.min(a.cruise, b.cruise);
            a.r = Math.sqrt(total);
            a.age = 0;
            blobs.splice(j, 1);
            j--;
          }
        }
      }
      // Fission: now and then a big, settled bubble pinches into two that drift apart.
      if (blobs.length < MAX_BLOBS && Math.random() < 0.005) {
        const big = blobs.filter((b) => b.r > unit() * 0.07 && b.age > 480);
        const parent = big[Math.floor(Math.random() * big.length)];
        if (parent) {
          const r = parent.r / Math.SQRT2; // same sum of r², so the split starts seamlessly
          const angle = Math.random() * Math.PI * 2;
          const push = parent.cruise * 2.5;
          const child: Blob = {
            x: parent.x,
            y: parent.y,
            vx: parent.vx - Math.cos(angle) * push,
            vy: parent.vy - Math.sin(angle) * push,
            r,
            age: 0,
            heading: angle + Math.PI,
            cruise: parent.cruise * 1.2,
          };
          parent.r = r;
          parent.vx += Math.cos(angle) * push;
          parent.vy += Math.sin(angle) * push;
          parent.heading = angle;
          parent.cruise *= 1.2;
          parent.age = 0;
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
      const scaled = blobs.map((b) => ({ x: b.x / scale - 0.5, y: b.y / scale - 0.5, r2: (b.r / scale) ** 2 }));
      let k = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          let f = 0;
          for (const b of scaled) {
            const dx = x - b.x;
            const dy = y - b.y;
            f += b.r2 / (dx * dx + dy * dy + 0.01);
          }
          values[y * fw + x] = f;
          // The fill: faint inside, a little stronger just under the surface; the edge itself is the stroke.
          let alpha = 0;
          if (f > SURFACE) alpha = 0.06 + 0.12 * Math.max(0, 1 - (f - SURFACE) / 0.8) ** 2;
          data[k] = 110;
          data[k + 1] = 190;
          data[k + 2] = 230;
          data[k + 3] = alpha * 255;
          k += 4;
        }
      }
      fieldCtx.putImageData(image, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(field, 0, 0, fw * scale, fh * scale);

      // The membrane: a crisp line on the surface, with a soft glow; then a fainter refraction line inside.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      traceContour(ctx, values, fw, fh, SURFACE, scale);
      ctx.strokeStyle = "rgba(95, 180, 225, 0.55)";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "rgba(95, 211, 230, 0.5)";
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      traceContour(ctx, values, fw, fh, INNER_LINE, scale);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // A small highlight on each bubble, where the lab's ceiling lights catch it.
      for (const b of blobs) {
        const hx = b.x - b.r * 0.35;
        const hy = b.y - b.r * 0.4;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, b.r * 0.28);
        g.addColorStop(0, "rgba(255, 255, 255, 0.55)");
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, b.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onResize = () => {
      resize();
      if (still) draw();
    };
    window.addEventListener("resize", onResize);

    // Redrawn every frame; if this machine needs more than ~9 ms for it, every other frame instead.
    let frame = 0;
    let tick = 0;
    let cost = 0;
    const loop = () => {
      step();
      if (cost < 9 || tick % 2 === 0) {
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

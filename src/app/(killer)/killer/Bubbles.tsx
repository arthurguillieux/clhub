"use client";

import { useEffect, useRef } from "react";

type Blob = { x: number; y: number; vx: number; vy: number; r: number; age: number };

/** Field resolution: about this many computed points across the screen, smoothed when drawn. */
const FIELD_WIDTH = 320;
const MIN_BLOBS = 7;
const MAX_BLOBS = 13;

/**
 * Water bubbles in zero gravity, like a lava lamp with nothing pulling them: very transparent
 * blue blobs drifting through the lab, merging when they meet and now and then splitting in two.
 * Drawn as metaballs — every point sums r²/d² over the bubbles, and the surface is where that
 * sum reaches 1 — with a brighter membrane near the edge and a small highlight, so they read as
 * water without taking the eye. Decorative; reduced motion gets one still frame.
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
    let scale = 4; // screen pixels per computed point: ~5 ms per surface on a full-HD TV
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
    };
    resize();

    const unit = () => Math.min(width, height);
    const spawn = (): Blob => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: unit() * (0.045 + Math.random() * 0.05),
      age: 0,
    });
    const blobs: Blob[] = Array.from({ length: 10 }, spawn);

    const step = () => {
      for (const b of blobs) {
        b.age++;
        // A slow wander: tiny random nudges, a little drag, a soft push back from the edges.
        b.vx = (b.vx + (Math.random() - 0.5) * 0.02) * 0.995;
        b.vy = (b.vy + (Math.random() - 0.5) * 0.02) * 0.995;
        if (b.x < b.r) b.vx += 0.01;
        if (b.x > width - b.r) b.vx -= 0.01;
        if (b.y < b.r) b.vy += 0.01;
        if (b.y > height - b.r) b.vy -= 0.01;
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
            a.r = Math.sqrt(total);
            a.age = 0;
            blobs.splice(j, 1);
            j--;
          }
        }
      }
      // Fission: now and then a big, settled bubble pinches into two that drift apart.
      if (blobs.length < MAX_BLOBS && Math.random() < 0.004) {
        const big = blobs.filter((b) => b.r > unit() * 0.07 && b.age > 600);
        const parent = big[Math.floor(Math.random() * big.length)];
        if (parent) {
          const r = parent.r / Math.SQRT2; // same sum of r², so the split starts seamlessly
          const angle = Math.random() * Math.PI * 2;
          const push = 0.25;
          const child: Blob = { x: parent.x, y: parent.y, vx: parent.vx - Math.cos(angle) * push, vy: parent.vy - Math.sin(angle) * push, r, age: 0 };
          parent.r = r;
          parent.vx += Math.cos(angle) * push;
          parent.vy += Math.sin(angle) * push;
          parent.age = 0;
          blobs.push(child);
        }
      }
      // Keep a few around if fusion went far.
      if (blobs.length < MIN_BLOBS) blobs.push(spawn());
    };

    const draw = () => {
      if (!image) return;
      const data = image.data;
      const fw = field.width;
      const fh = field.height;
      const scaled = blobs.map((b) => ({ x: b.x / scale, y: b.y / scale, r2: (b.r / scale) ** 2 }));
      let k = 0;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          let f = 0;
          for (const b of scaled) {
            const dx = x - b.x;
            const dy = y - b.y;
            f += b.r2 / (dx * dx + dy * dy + 0.01);
          }
          // Outside: nothing. Edge: a soft membrane. Inside: a faint fill.
          let alpha = 0;
          if (f > 0.85) {
            const edge = Math.min(1, (f - 0.85) / 0.15); // anti-aliased surface
            const membrane = Math.max(0, 1 - (f - 1) / 0.9); // brighter just inside the surface
            alpha = edge * (0.07 + 0.2 * membrane * membrane);
          }
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
      // A small highlight on each bubble, where the lab's ceiling lights catch it.
      for (const b of blobs) {
        const hx = b.x - b.r * 0.35;
        const hy = b.y - b.r * 0.4;
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, b.r * 0.3);
        g.addColorStop(0, "rgba(255, 255, 255, 0.45)");
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx, hy, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onResize = () => {
      resize();
      if (still) draw();
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    let tick = 0;
    const loop = () => {
      step();
      // The surface is recomputed every other frame: smooth enough for something this slow.
      if (tick++ % 2 === 0) draw();
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

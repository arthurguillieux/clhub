"use client";

import { useEffect, useRef } from "react";

/**
 * Gentle snow over the page, and a garland across the top. The flakes are soft and warm-white, one in
 * five lit green or red like the neon. Decorative: a frame that fails is simply skipped, and with
 * reduced motion the flakes stay still.
 */
export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const resize = () => {
      if (canvas.offsetWidth < 20 || canvas.offsetHeight < 20) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const tints = ["246, 239, 226", "246, 239, 226", "246, 239, 226", "246, 239, 226", "57, 255, 176", "255, 59, 78"];
    const flakes = Array.from({ length: Math.min(90, Math.round((width * height) / 16000)) }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.8 + Math.random() * 2.2,
      fall: 0.2 + Math.random() * 0.55,
      sway: Math.random() * Math.PI * 2,
      tint: tints[i % tints.length]!,
      alpha: 0.25 + Math.random() * 0.45,
    }));

    let frame = 0;
    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${f.tint}, ${f.alpha})`;
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const loop = () => {
      for (const f of flakes) {
        f.sway += 0.012;
        f.y += f.fall;
        f.x += Math.sin(f.sway) * 0.35;
        if (f.y > height + 4) {
          f.y = -4;
          f.x = Math.random() * width;
        }
      }
      paint();
      frame = requestAnimationFrame(loop);
    };
    if (still) paint();
    else frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full" />;
}

const BULBS = ["var(--s-green)", "var(--s-red)", "var(--s-gold)"];

export function Garland() {
  return (
    <div aria-hidden="true" className="santa-garland">
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className="santa-bulb"
          style={{ color: BULBS[i % BULBS.length], marginTop: 5 + Math.round(9 * Math.abs(Math.sin(i * 0.62))), animationDelay: `${(i * 0.37) % 2.6}s` }}
        />
      ))}
    </div>
  );
}

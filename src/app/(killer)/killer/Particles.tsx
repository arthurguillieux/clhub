"use client";

import { useEffect, useRef } from "react";

/**
 * Blue particles drifting in every direction, linked by a hairline when two come close — a molecule
 * under the microscope more than a starfield. Decorative; skipped when reduced motion is asked for.
 */
export function Particles({ density = 60 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = devicePixelRatio;
    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.width = canvas.offsetWidth * dpr;
      height = canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const dots = Array.from({ length: density }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35 * dpr,
      vy: (Math.random() - 0.5) * 0.35 * dpr,
      r: (1 + Math.random() * 2.2) * dpr,
      phase: Math.random() * Math.PI * 2,
    }));
    const linkDistance = 140 * dpr;

    let frame = 0;
    let t = 0;
    const tick = () => {
      t += 0.012;
      ctx.clearRect(0, 0, width, height);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -20) d.x = width + 20;
        if (d.x > width + 20) d.x = -20;
        if (d.y < -20) d.y = height + 20;
        if (d.y > height + 20) d.y = -20;
      }
      ctx.lineWidth = dpr;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i]!;
          const b = dots[j]!;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < linkDistance) {
            ctx.strokeStyle = `rgba(23, 105, 245, ${0.14 * (1 - dist / linkDistance)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const d of dots) {
        const glow = 0.45 + 0.35 * Math.sin(t * 2 + d.phase);
        ctx.beginPath();
        ctx.fillStyle = `rgba(41, 150, 246, ${glow})`;
        ctx.shadowColor = "rgba(41, 182, 246, 0.8)";
        ctx.shadowBlur = 10 * dpr;
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}

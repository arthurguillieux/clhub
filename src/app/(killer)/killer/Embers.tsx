"use client";

import { useEffect, useRef } from "react";

/** Sparks drifting up from the bottom of the screen. Decorative; skipped when reduced motion is asked for. */
export function Embers({ density = 60 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.width = canvas.offsetWidth * devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (anywhere: boolean) => ({
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : height + 10,
      r: (0.6 + Math.random() * 1.8) * devicePixelRatio,
      vy: (0.3 + Math.random() * 1.1) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.4 * devicePixelRatio,
      life: 0.4 + Math.random() * 0.6,
      hue: 20 + Math.random() * 25,
    });
    const sparks = Array.from({ length: density }, () => spawn(true));

    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (const s of sparks) {
        s.y -= s.vy;
        s.x += s.vx + Math.sin((s.y + s.x) / 60) * 0.25;
        const fade = Math.max(0, Math.min(1, s.y / height)) * s.life;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 100%, 60%, ${fade})`;
        ctx.shadowColor = `hsla(${s.hue}, 100%, 55%, ${fade})`;
        ctx.shadowBlur = 8 * devicePixelRatio;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.y < -10) Object.assign(s, spawn(false));
      }
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

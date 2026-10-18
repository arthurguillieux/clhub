"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number };
type Trace = { points: Point[]; lengths: number[]; total: number };
type Signal = { trace: Trace; at: number; speed: number; wait: number };

/** Unit steps: mostly straight runs, sometimes a 45° bend, like a printed circuit. */
const DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

function makeTrace(width: number, height: number, cell: number): Trace {
  let x = Math.round((Math.random() * width) / cell) * cell;
  let y = Math.round((Math.random() * height) / cell) * cell;
  let dir = Math.floor(Math.random() * 4) * 2; // start orthogonal
  const points: Point[] = [{ x, y }];
  const segments = 3 + Math.floor(Math.random() * 5);
  for (let s = 0; s < segments; s++) {
    const step = DIRECTIONS[dir]!;
    const run = (1 + Math.floor(Math.random() * 4)) * cell;
    x += step.x * run;
    y += step.y * run;
    points.push({ x, y });
    dir = (dir + (Math.random() < 0.5 ? 1 : 7)) % 8; // bend by 45° either way
  }
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  return { points, lengths, total: lengths.reduce((a, b) => a + b, 0) };
}

function pointAt(trace: Trace, distance: number): Point {
  let d = distance;
  for (let i = 0; i < trace.lengths.length; i++) {
    const len = trace.lengths[i]!;
    if (d <= len) {
      const a = trace.points[i]!;
      const b = trace.points[i + 1]!;
      return { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len };
    }
    d -= len;
  }
  return trace.points[trace.points.length - 1]!;
}

/**
 * The lab's living wall: white circuitry embossed in the background, cyan signals running along
 * it, and a few particles floating in the light. Drawn once, then only the signals move.
 * Decorative; reduced motion gets the still circuitry without signals. `motes` keeps only the
 * floating particles, for the TV where the 3D lab is the backdrop.
 */
export function Particles({ density = 60, variant = "circuit" }: { density?: number; variant?: "circuit" | "motes" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = devicePixelRatio;
    const board = document.createElement("canvas");
    const boardCtx = board.getContext("2d");
    if (!boardCtx) return;

    let width = 0;
    let height = 0;
    let traces: Trace[] = [];
    let signals: Signal[] = [];
    let motes: { x: number; y: number; vx: number; vy: number; r: number; phase: number }[] = [];

    const newSignal = (): Signal => ({
      trace: traces[Math.floor(Math.random() * traces.length)]!,
      at: 0,
      speed: (0.8 + Math.random() * 1.6) * dpr,
      wait: Math.floor(Math.random() * 240),
    });

    const build = () => {
      width = canvas.width = board.width = canvas.offsetWidth * dpr;
      height = canvas.height = board.height = canvas.offsetHeight * dpr;
      const cell = 36 * dpr;
      const count = Math.round(((width * height) / (cell * cell * 9)) * (density / 60));
      traces = variant === "circuit" ? Array.from({ length: Math.max(8, count) }, () => makeTrace(width, height, cell)) : [];

      // Embossed white tracks: a soft shadow under, a white line on top, a ring at each end.
      boardCtx.clearRect(0, 0, width, height);
      boardCtx.lineJoin = "round";
      boardCtx.lineCap = "round";
      for (const [color, offset, lineWidth] of [
        ["rgba(110, 124, 138, 0.16)", 1.2 * dpr, 2.4 * dpr],
        ["rgba(255, 255, 255, 0.95)", 0, 1.6 * dpr],
      ] as const) {
        boardCtx.strokeStyle = color;
        boardCtx.lineWidth = lineWidth;
        for (const t of traces) {
          boardCtx.beginPath();
          t.points.forEach((p, i) => (i ? boardCtx.lineTo(p.x + offset, p.y + offset) : boardCtx.moveTo(p.x + offset, p.y + offset)));
          boardCtx.stroke();
          for (const end of [t.points[0]!, t.points[t.points.length - 1]!]) {
            boardCtx.beginPath();
            boardCtx.arc(end.x + offset, end.y + offset, 3.6 * dpr, 0, Math.PI * 2);
            boardCtx.stroke();
          }
        }
      }

      signals = traces.length ? Array.from({ length: Math.ceil(traces.length / 2) }, newSignal) : [];
      motes = Array.from({ length: Math.round(density / 3) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25 * dpr,
        vy: (Math.random() - 0.5) * 0.25 * dpr,
        r: (0.8 + Math.random() * 1.6) * dpr,
        phase: Math.random() * Math.PI * 2,
      }));
      if (still) ctx.drawImage(board, 0, 0);
    };
    build();
    window.addEventListener("resize", build);

    let frame = 0;
    let time = 0;
    const tick = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(board, 0, 0);
      if (still) return;

      ctx.lineCap = "round";
      for (const s of signals) {
        if (s.wait > 0) {
          s.wait--;
          continue;
        }
        s.at += s.speed;
        const head = pointAt(s.trace, Math.min(s.at, s.trace.total));
        const tail = pointAt(s.trace, Math.max(0, s.at - 46 * dpr));
        const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, "rgba(95, 211, 230, 0)");
        gradient.addColorStop(1, "rgba(95, 211, 230, 0.9)");
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.2 * dpr;
        ctx.beginPath();
        // Follow the track's bends between tail and head.
        ctx.moveTo(tail.x, tail.y);
        for (let d = Math.max(0, s.at - 46 * dpr) + 6 * dpr; d < Math.min(s.at, s.trace.total); d += 6 * dpr) {
          const p = pointAt(s.trace, d);
          ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "rgba(170, 238, 248, 0.95)";
        ctx.shadowColor = "rgba(95, 211, 230, 0.9)";
        ctx.shadowBlur = 12 * dpr;
        ctx.arc(head.x, head.y, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (s.at - 46 * dpr > s.trace.total) Object.assign(s, newSignal());
      }

      for (const m of motes) {
        m.x = (m.x + m.vx + width) % width;
        m.y = (m.y + m.vy + height) % height;
        ctx.beginPath();
        ctx.fillStyle = `rgba(95, 200, 230, ${0.25 + 0.25 * Math.sin(time * 1.5 + m.phase)})`;
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", build);
    };
  }, [density, variant]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}

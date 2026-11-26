"use client";

import { useRef, useState } from "react";
import type { Act } from "./controls";

/** The pad's units: the room's screen (16:9), 1000 wide. */
const W = 1000;
const H = 562;

/**
 * « Intrusion dessinée »: the meneur draws with a finger, the room sees it trace itself, stroke by stroke,
 * in Marga's magenta. Points closer than a few units are dropped, so a drawing stays a small message.
 */
export function DrawPad({ busy, act, shown }: { busy: boolean; act: Act; shown: boolean }) {
  const [strokes, setStrokes] = useState<number[][]>([]);
  const [current, setCurrent] = useState<number[] | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)] as const;
  };
  const path = (pts: number[]) => pts.reduce((d, v, i) => d + (i % 2 === 0 ? `${i === 0 ? "M" : "L"}${v} ` : `${v} `), "");

  return (
    <div className="flex flex-col gap-1.5">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none rounded-lg border border-[var(--scn-magenta)] bg-[#06030a]"
        aria-label="Zone de dessin de l'intrusion"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const [x, y] = point(e);
          setCurrent([x, y]);
        }}
        onPointerMove={(e) => {
          if (!current) return;
          const [x, y] = point(e);
          const lx = current[current.length - 2]!;
          const ly = current[current.length - 1]!;
          if (Math.hypot(x - lx, y - ly) < 6 || current.length >= 800) return;
          setCurrent([...current, Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))]);
        }}
        onPointerUp={() => {
          if (current && current.length >= 4 && strokes.length < 80) setStrokes([...strokes, current]);
          setCurrent(null);
        }}
      >
        {[...strokes, ...(current ? [current] : [])].map((st, i) => (
          <path key={i} d={path(st)} fill="none" stroke="#ff3ec9" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className="scn-btn" disabled={!strokes.length} onClick={() => setStrokes(strokes.slice(0, -1))}>
          Annuler le trait
        </button>
        <button type="button" className="scn-btn" disabled={!strokes.length} onClick={() => setStrokes([])}>
          Effacer
        </button>
        <button
          type="button"
          className="scn-btn scn-btn-fault"
          disabled={busy || !strokes.length}
          onClick={async () => {
            if (!(await act({ t: "drawing", strokes }))) setStrokes([]);
          }}
        >
          Envoyer
        </button>
      </div>
      {shown && (
        <button type="button" className="scn-btn" disabled={busy} onClick={() => void act({ t: "drawing", strokes: null })}>
          Retirer le dessin de l&apos;écran
        </button>
      )}
    </div>
  );
}

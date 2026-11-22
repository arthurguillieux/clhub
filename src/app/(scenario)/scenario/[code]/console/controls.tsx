"use client";

import type { Action } from "@/modules/loups/scenarios/engine";

export type Act = (action: Action) => Promise<string | null>;

/** Play, pause, back to the start, ±10 s: for the tape on the terminal, or the last sound played. */
export function MediaControls({ busy, act }: { busy: boolean; act: Act }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {(
        [
          ["restart", "⏮", "Au début"],
          ["back", "−10 s", "Reculer de 10 s"],
          ["pause", "⏸", "Pause"],
          ["play", "▶", "Lecture"],
          ["forward", "+10 s", "Avancer de 10 s"],
        ] as const
      ).map(([cmd, label, aria]) => (
        <button key={cmd} type="button" aria-label={aria} className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "media", cmd })}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** A timer's controls: pause or resume, one minute more or less, stop. */
export function TimerControls({ which, timer, busy, act }: { which: "gauge" | "main"; timer: { endsAt: number | null } | null; busy: boolean; act: Act }) {
  if (!timer) return null;
  return (
    <div className="grid grid-cols-4 gap-1">
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: timer.endsAt === null ? "resume" : "pause" })}>
        {timer.endsAt === null ? "▶ Reprendre" : "⏸ Pause"}
      </button>
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "minus" })}>
        −1 min
      </button>
      <button type="button" className="scn-btn min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "plus" })}>
        +1 min
      </button>
      <button type="button" className="scn-btn scn-btn-danger min-h-10 px-1 text-xs" disabled={busy} onClick={() => void act({ t: "timer", which, cmd: "stop" })}>
        ■ Arrêter
      </button>
    </div>
  );
}

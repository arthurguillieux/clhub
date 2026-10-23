"use client";

import { useEffect, useRef, useState } from "react";
import { LEAVE_AFTER_ZERO_S, countdownNumberAt } from "@/modules/killer/countdown";

/**
 * When the countdown started — on the TV's audio clock when the sound is on, otherwise on the page's
 * clock — and when, from there, each of 10, 9 … 0 is due: on the shots found in the organizer's file,
 * or on the whole seconds.
 */
export type Launch = { audioStart: number | null; perfStart: number; shots: readonly number[] };

const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/**
 * The picture runs this far ahead of the sound, for the frame or two it takes to show a number; the
 * TV's « Synchro » knob (`lead`) adds to it, for a TV that takes longer to show what it gets over HDMI.
 */
const VISUAL_LEAD_S = 0.05;

/**
 * The launch screen between « Lancer la partie » and the arena: 10 … 0, one number per cannon shot,
 * a ring that fills over each second and a ripple on every shot; at 0 « Simulation lancée », then
 * it fades out onto the arena while the sound plays on. Kept in the lab's look.
 */
export function LaunchCountdown({
  launch,
  getAudio,
  title,
  lead,
  onDone,
}: {
  launch: Launch;
  getAudio: () => AudioContext | null;
  title: string;
  /** Extra head start of the picture over the sound, in seconds (the TV's « Synchro »). */
  lead: number;
  onDone: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(onDone);
  const audioOf = useRef(getAudio);
  const leadRef = useRef(lead);
  useEffect(() => {
    done.current = onDone;
    audioOf.current = getAudio;
    leadRef.current = lead;
  }, [onDone, getAudio, lead]);
  const zero = launch.shots[launch.shots.length - 1]!;
  const leaveAt = zero + LEAVE_AFTER_ZERO_S;

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const audio = audioOf.current();
      const t =
        (launch.audioStart !== null && audio && audio.state === "running"
          ? audio.currentTime - launch.audioStart
          : (performance.now() - launch.perfStart) / 1000) +
        VISUAL_LEAD_S +
        leadRef.current;
      setElapsed(t);
      if (t >= leaveAt) return done.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [launch, leaveAt]);

  const number = countdownNumberAt(elapsed, launch.shots);
  const launched = elapsed >= zero;
  // The ring fills from one shot to the next (from the start up to the first).
  const previous = [0, ...launch.shots].filter((s) => s <= elapsed).pop() ?? 0;
  const next = launch.shots.find((s) => s > elapsed) ?? zero;
  const progress = next > previous ? Math.min(1, Math.max(0, (elapsed - previous) / (next - previous))) : 1;
  // Fades onto the arena over the last moments.
  const fade = Math.min(1, Math.max(0, (leaveAt - elapsed) / 0.6));

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.82),rgba(226,230,234,0.88)_70%)]"
      style={{ opacity: fade }}
      role="status"
      aria-live="assertive"
    >
      <p className="killer-label" style={{ fontSize: "min(1.6vw, 2.8vh)" }}>
        Lancement de la simulation
      </p>
      <p className="mt-[1vh] text-[var(--k-muted)]" style={{ fontSize: "min(1.8vw, 3vh)" }}>
        {title}
      </p>

      <div className="relative mt-[3vh] flex items-center justify-center" style={{ width: "min(46vw, 62vh)", height: "min(46vw, 62vh)" }}>
        {number !== null && !launched && <span key={`wave-${number}`} aria-hidden="true" className="killer-count-wave absolute inset-[6%] rounded-full" />}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="var(--k-line)" strokeWidth="1.2" />
          {!launched && (
            <circle
              cx="50"
              cy="50"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--k-glow)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              style={{ filter: "drop-shadow(0 0 1.5px rgba(95, 211, 230, 0.9))" }}
            />
          )}
        </svg>
        {launched ? (
          <p key="launched" className="killer-count-pop killer-title text-center" style={{ fontSize: "min(5vw, 9vh)", lineHeight: 1.15 }}>
            Simulation
            <br />
            lancée
          </p>
        ) : number === null ? (
          <p className="killer-title text-[var(--k-muted)]" style={{ fontSize: "min(3.4vw, 6vh)" }}>
            Prêts ?
          </p>
        ) : (
          <span key={number} className="killer-count-pop killer-title tabular-nums" style={{ fontSize: "min(20vw, 34vh)", lineHeight: 1 }}>
            {number}
          </span>
        )}
      </div>

      <p className="mt-[3vh] text-[var(--k-muted)]" style={{ fontSize: "min(1.6vw, 2.8vh)" }}>
        {launched ? "Regardez vos téléphones : vos cibles sont arrivées." : "Vos cibles arrivent sur vos téléphones à zéro."}
      </p>
      {launched && <span key="flash" aria-hidden="true" className="killer-count-flash pointer-events-none absolute inset-0 bg-white" />}
    </div>
  );
}

"use client";

import { useState } from "react";

type Phase = "idle" | "seal" | "flap" | "letter";

/** When each step starts, from the tap: the seal pops, the flap opens, the letter slides out. */
const STEPS: [Phase, number][] = [
  ["flap", 420],
  ["letter", 1050],
];
const OPENED_AT = 2250;

/** The closed letter, sealed with the child's initial: tap it to open it. */
export function Envelope({ childName, onOpened }: { childName: string; onOpened: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const open = () => {
    if (phase !== "idle") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onOpened();
    setPhase("seal");
    for (const [next, at] of STEPS) setTimeout(() => setPhase(next), at);
    setTimeout(onOpened, OPENED_AT);
  };

  return (
    <div className="mt-8 flex flex-col items-center text-center">
      <p className="santa-label santa-note">Une lettre pour le Père Noël</p>
      <h1 className="santa-title mt-2 text-3xl">{childName} a écrit sa lettre</h1>
      <p className="santa-note mt-2 max-w-sm text-[var(--s-muted)]">Elle est pour le Père Noël, mais il a besoin d&apos;un coup de main. Ouvrez-la&#8239;!</p>
      <button type="button" onClick={open} aria-label="Ouvrir la lettre" data-phase={phase} className="lettre-envelope mt-10">
        <span aria-hidden="true" className="lettre-env-back" />
        <span aria-hidden="true" className="lettre-env-paper lettre-hand">
          Cher Père Noël,
          <br />
          voici ma liste…
        </span>
        <span aria-hidden="true" className="lettre-env-front lettre-hand text-sm">
          Au Père Noël · Pôle Nord
        </span>
        <span aria-hidden="true" className="lettre-env-flap" />
        <span aria-hidden="true" className="lettre-env-seal">
          {childName.charAt(0).toUpperCase()}
        </span>
        {/* Where the snow settles; it slides off as the seal pops. */}
        {phase === "idle" && <span aria-hidden="true" className="santa-ledge absolute inset-x-[2%] top-0 h-px" />}
      </button>
      <button type="button" onClick={open} disabled={phase !== "idle"} className="santa-btn santa-ledge mt-10 min-h-14 px-8 text-lg">
        {phase === "idle" ? "💌 Ouvrir la lettre" : "Ça s'ouvre…"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { recordNaturalOneAction, recordNaturalTwentyAction } from "@/core/easterEggs/actions";

const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
type DieType = (typeof DIE_TYPES)[number];

const DIE_SIDES: Record<DieType, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

const MIN_COUNT = 1;
const MAX_COUNT = 8;
// Must match the `dice-roll` keyframe duration in globals.css — the cube's
// toss animation and the moment we reveal the real result are one and the
// same beat, not two things that happen to be close.
const ROLL_DURATION_MS = 900;

function rollOnce(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

interface Spin {
  rx: number;
  ry: number;
  rz: number;
}

/** A fresh, random tumble per die per roll — so a set of dice doesn't spin in lockstep like one shared prop. */
function randomSpin(): Spin {
  const turns = (min: number, max: number) => (min + Math.floor(Math.random() * (max - min + 1))) * 360;
  return {
    rx: turns(3, 5),
    ry: turns(2, 4),
    rz: Math.floor(Math.random() * 17) - 8,
  };
}

function Die({
  value,
  rolling,
  tone,
  spin,
}: {
  value: number;
  rolling: boolean;
  tone: "accent" | "muted" | "primary";
  spin: Spin;
}) {
  const faceTone =
    tone === "accent"
      ? "glow-box-accent border-accent text-accent"
      : tone === "muted"
        ? "border-line-soft text-muted"
        : "glow-box-primary border-primary/50 text-ink";

  return (
    <div className="dice-scene h-16 w-16">
      <div
        className={`dice-cube ${rolling ? "dice-spinning" : ""}`}
        style={
          {
            "--dice-rx": `${spin.rx}deg`,
            "--dice-ry": `${spin.ry}deg`,
            "--dice-rz": `${spin.rz}deg`,
          } as React.CSSProperties
        }
      >
        <div className={`dice-face dice-face-front bg-surface-raised ${faceTone}`}>{value}</div>
        <div className="dice-face dice-face-back border-line-soft bg-surface-raised text-muted">•</div>
        <div className="dice-face dice-face-right border-line-soft bg-surface-raised text-muted">•</div>
        <div className="dice-face dice-face-left border-line-soft bg-surface-raised text-muted">•</div>
        <div className="dice-face dice-face-top border-line-soft bg-surface-raised text-muted">•</div>
        <div className="dice-face dice-face-bottom border-line-soft bg-surface-raised text-muted">•</div>
      </div>
    </div>
  );
}

export function DiceRoller() {
  const [dieType, setDieType] = useState<DieType>("d6");
  const [count, setCount] = useState(2);
  const [display, setDisplay] = useState<number[]>([]);
  const [spins, setSpins] = useState<Spin[]>([]);
  const [rolling, setRolling] = useState(false);
  const [settled, setSettled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function roll() {
    if (rolling) return;
    const sides = DIE_SIDES[dieType];
    setRolling(true);
    setSettled(false);
    // Placeholder faces while the cube tumbles — the real result only
    // appears once it stops, same as a physical die.
    setDisplay(Array.from({ length: count }, () => 1));
    setSpins(Array.from({ length: count }, randomSpin));

    timerRef.current = setTimeout(() => {
      const finalValues = Array.from({ length: count }, () => rollOnce(sides));
      setDisplay(finalValues);
      setRolling(false);
      setSettled(true);

      if (dieType === "d20") {
        if (finalValues.includes(20)) recordNaturalTwentyAction().catch(() => {});
        if (finalValues.includes(1)) recordNaturalOneAction().catch(() => {});
      }
    }, ROLL_DURATION_MS);
  }

  const total = display.length > 0 ? display.reduce((sum, v) => sum + v, 0) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Type de dé</p>
        <div className="flex flex-wrap gap-2">
          {DIE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setDieType(type);
                setDisplay([]);
                setSettled(false);
              }}
              aria-pressed={dieType === type}
              className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                dieType === type
                  ? "border-primary bg-primary text-primary-ink glow-box-primary"
                  : "border-line bg-surface text-ink hover:bg-surface-raised"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <p className="text-sm font-medium text-muted">Nombre de dés</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(MIN_COUNT, c - 1))}
            aria-label="Moins de dés"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-ink hover:bg-surface-raised"
          >
            −
          </button>
          <span className="w-4 text-center font-semibold tabular-nums text-ink">{count}</span>
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(MAX_COUNT, c + 1))}
            aria-label="Plus de dés"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-ink hover:bg-surface-raised"
          >
            +
          </button>
        </div>
      </div>

      <Button type="button" variant="accent" onClick={roll} disabled={rolling} className="self-start">
        {rolling ? "..." : "Lancer"}
      </Button>

      {display.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            {display.map((value, i) => {
              const isNat20 = settled && dieType === "d20" && value === 20;
              const isNat1 = settled && dieType === "d20" && value === 1;
              const tone = isNat20 ? "accent" : isNat1 ? "muted" : "primary";
              const spin = spins[i] ?? { rx: 1080, ry: 1080, rz: 0 };
              return <Die key={i} value={value} rolling={rolling} tone={tone} spin={spin} />;
            })}
          </div>

          {settled && dieType === "d20" && display.includes(20) && (
            <p className="glow-text-accent text-sm font-semibold text-accent">Critique !</p>
          )}
          {settled && dieType === "d20" && display.includes(1) && (
            <p className="text-sm font-semibold text-muted">Échec critique... ça arrive.</p>
          )}
          {total !== null && count > 1 && (
            <p className="text-sm text-muted">
              Total : <span className="font-semibold tabular-nums text-ink">{total}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

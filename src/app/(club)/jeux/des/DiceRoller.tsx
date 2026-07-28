"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { recordNaturalOneAction, recordNaturalTwentyAction } from "@/core/easterEggs/actions";

const DIE_TYPES = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
type DieType = (typeof DIE_TYPES)[number];

const DIE_SIDES: Record<DieType, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

const MIN_COUNT = 1;
const MAX_COUNT = 8;
const ROLL_DURATION_MS = 700;
const ROLL_TICK_MS = 80;

function rollOnce(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

export function DiceRoller() {
  const [dieType, setDieType] = useState<DieType>("d6");
  const [count, setCount] = useState(2);
  const [display, setDisplay] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [settled, setSettled] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function roll() {
    if (rolling) return;
    const sides = DIE_SIDES[dieType];
    setRolling(true);
    setSettled(false);

    const startedAt = Date.now();
    intervalRef.current = setInterval(() => {
      setDisplay(Array.from({ length: count }, () => rollOnce(sides)));
      if (Date.now() - startedAt >= ROLL_DURATION_MS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const finalValues = Array.from({ length: count }, () => rollOnce(sides));
        setDisplay(finalValues);
        setRolling(false);
        setSettled(true);

        if (dieType === "d20") {
          if (finalValues.includes(20)) recordNaturalTwentyAction().catch(() => {});
          if (finalValues.includes(1)) recordNaturalOneAction().catch(() => {});
        }
      }
    }, ROLL_TICK_MS);
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
          <div className="flex flex-wrap gap-3">
            {display.map((value, i) => {
              const isNat20 = settled && dieType === "d20" && value === 20;
              const isNat1 = settled && dieType === "d20" && value === 1;
              return (
                <div
                  key={i}
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border font-display text-2xl font-extrabold tabular-nums ${
                    rolling
                      ? "dice-rolling border-line bg-surface-raised text-muted"
                      : isNat20
                        ? "dice-settle glow-box-accent border-accent bg-surface-raised text-accent"
                        : isNat1
                          ? "dice-settle border-line-soft bg-surface text-muted"
                          : "dice-settle glow-box-primary border-primary/50 bg-surface-raised text-ink"
                  }`}
                >
                  {value}
                </div>
              );
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

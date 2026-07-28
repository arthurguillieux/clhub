"use client";

import { useEffect, useState } from "react";
import { recordKonamiCodeFoundAction } from "@/core/easterEggs/actions";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

const TOAST_DURATION_MS = 3200;

/** Mounted once at the root — works on any page, logged in or not (the record action just no-ops without a session). */
export function KonamiListener() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let position = 0;
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[position]) {
        position += 1;
        if (position === SEQUENCE.length) {
          position = 0;
          setVisible(true);
          recordKonamiCodeFoundAction().catch(() => {});
        }
      } else {
        position = key === SEQUENCE[0] ? 1 : 0;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className="egg-pop glow-box-primary flex items-center gap-3 rounded-card border border-primary/50 bg-surface-raised px-5 py-3">
        <span aria-hidden="true" className="text-2xl">
          🥚
        </span>
        <div>
          <p className="font-display text-sm font-extrabold text-ink">L&apos;œuf caché</p>
          <p className="text-xs text-muted">Comme dans Ready Player One.</p>
        </div>
      </div>
    </div>
  );
}

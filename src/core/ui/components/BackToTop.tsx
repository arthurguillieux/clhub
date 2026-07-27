"use client";

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 400;

/** One instance in the (club) layout covers every page — no per-page wiring. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Haut de page"
      className="glow-box-primary fixed right-4 bottom-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-surface-raised text-lg text-primary hover:bg-surface print:hidden sm:right-6 sm:bottom-6"
    >
      ↑
    </button>
  );
}

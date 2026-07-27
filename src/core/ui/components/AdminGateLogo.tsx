"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { unlockAdminAction, type UnlockAdminState } from "@/app/(club)/admin/actions";

const CLICK_WINDOW_MS = 1200;
const CLICKS_NEEDED = 3;

// Module scope, not component state: a client-side navigation on click #1
// (the logo's own href="/") unmounts and remounts this component, which
// would wipe a useState counter before click #2 ever lands.
let recentClicks: number[] = [];

const initialState: UnlockAdminState = { status: "idle" };

export function AdminGateLogo() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(unlockAdminAction, initialState);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleClick(e: React.MouseEvent) {
    const now = Date.now();
    recentClicks = recentClicks.filter((t) => now - t < CLICK_WINDOW_MS);
    recentClicks.push(now);

    if (recentClicks.length >= CLICKS_NEEDED) {
      e.preventDefault();
      recentClicks = [];
      setOpen(true);
    }
  }

  return (
    <>
      <Link
        href="/"
        onClick={handleClick}
        className="font-display text-lg font-extrabold tracking-tight text-ink"
      >
        LE CL<span className="glow-text-primary text-primary">HUB</span>
      </Link>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glow-box-primary w-full max-w-xs rounded-card border border-primary/40 bg-surface-raised p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-extrabold text-ink">Accès admin</p>
            <form action={formAction} className="mt-3 flex flex-col gap-3">
              <input
                ref={inputRef}
                type="password"
                name="code"
                autoComplete="off"
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={pending}
                className="glow-box-primary rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:opacity-90"
              >
                {pending ? "Vérification..." : "Entrer"}
              </button>
              {state.status === "error" && (
                <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

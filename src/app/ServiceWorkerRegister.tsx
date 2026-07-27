"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js — see that file for what it actually caches and
 * why. Production only: the SW's cache-first strategy for `_next/static/`
 * assumes those filenames are content-hashed (true for a real build, see
 * ADR-010), but Turbopack dev chunk names stay stable across restarts —
 * every `pnpm dev` restart during active work would otherwise leave
 * browsers serving a stale JS chunk that no longer matches the running
 * server, surfacing as a "module factory is not available" crash.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline reading is a nice-to-have, not a hard requirement — a
        // failed registration (e.g. an old cached SW mid-update) shouldn't
        // surface as an error to the member.
      });
    }
  }, []);

  return null;
}

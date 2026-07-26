"use client";

import { useEffect } from "react";

/** Registers public/sw.js — see that file for what it actually caches and why. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline reading is a nice-to-have, not a hard requirement — a
        // failed registration (e.g. an old cached SW mid-update) shouldn't
        // surface as an error to the member.
      });
    }
  }, []);

  return null;
}

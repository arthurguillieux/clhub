"use client";

import { useFormStatus } from "react-dom";

/** Disabled from the first tap: a double tap used to open two games. */
export function NewGameButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="loups-btn min-h-12 px-6 text-base" disabled={pending}>
      {pending ? "Création…" : "🐺 Nouvelle partie"}
    </button>
  );
}

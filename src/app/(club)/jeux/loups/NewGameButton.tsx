"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/core/ui/components/Button";

/** Disabled from the first tap: a double tap used to open two games. */
export function NewGameButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" className="min-h-12 px-6 text-base" disabled={pending}>
      {pending ? "Création…" : "🐺 Nouvelle partie"}
    </Button>
  );
}

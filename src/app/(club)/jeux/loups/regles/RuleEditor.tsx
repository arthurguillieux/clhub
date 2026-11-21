"use client";

import { useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { Card } from "@/core/ui/components/Card";
import { ruleAction } from "@/app/(loups)/loups/actions";

/** One card's rule: rewritten, saved, or put back to the CLHUB's wording. */
export function RuleEditor({ role, name, text, original, custom }: { role: string; name: string; text: string; original: string; custom: boolean }) {
  const [value, setValue] = useState(text);
  const [saved, setSaved] = useState(text);
  const [mine, setMine] = useState(custom);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (next: string | null) => {
    setBusy(true);
    setError("");
    const result = await ruleAction(role, next).catch(() => ({ ok: false as const, error: "Pas de connexion — réessaie." }));
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const now = next ?? original;
    setValue(now);
    setSaved(now);
    setMine(next !== null && next.trim() !== original);
  };

  return (
    <Card className="p-4">
      <label className="flex flex-col gap-2">
        <span className="font-display font-bold text-ink">
          {name}
          {mine && <span className="ml-2 text-xs font-medium text-muted">ta version</span>}
        </span>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} maxLength={1500} className="w-full rounded-md border border-line bg-ground px-3 py-2 text-sm text-ink" />
      </label>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={busy || value === saved} onClick={() => void save(value)}>
          {value === saved && mine ? "Enregistrée ✓" : "Enregistrer la règle"}
        </Button>
        {mine && (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(null)}>
            Revenir au texte du CLHUB
          </Button>
        )}
      </div>
    </Card>
  );
}

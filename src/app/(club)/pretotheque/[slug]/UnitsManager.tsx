"use client";

import { useState, useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import {
  addItemUnitAction,
  archiveItemUnitAction,
  renameItemUnitAction,
  unarchiveItemUnitAction,
  type UnitActionResult,
} from "./actions";

interface Unit {
  id: string;
  label: string | null;
  archivedAt: Date | null;
}

/** Owner-only: how many independently-bookable copies this item has (ADR-004). */
export function UnitsManager({
  itemId,
  itemSlug,
  units,
}: {
  itemId: string;
  itemSlug: string;
  units: Unit[];
}) {
  const [newLabel, setNewLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const active = units.filter((u) => !u.archivedAt);
  const archived = units.filter((u) => u.archivedAt);

  function run(action: () => Promise<UnitActionResult>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {active.length <= 1
          ? "Un seul exemplaire pour l'instant — ajoute-en si tu en as plusieurs."
          : `${active.length} exemplaires disponibles au prêt, indépendamment.`}
      </p>

      {active.length > 1 && (
        <ul className="mt-3 flex flex-col gap-2">
          {active.map((unit, index) => (
            <li key={unit.id} className="flex items-center gap-2">
              <Input
                defaultValue={unit.label ?? ""}
                placeholder={`Exemplaire ${index + 1}`}
                disabled={pending}
                className="w-40 py-1"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === (unit.label ?? "")) return;
                  run(() => renameItemUnitAction(itemId, itemSlug, unit.id, next || null));
                }}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => archiveItemUnitAction(itemId, itemSlug, unit.id))}
                className="text-xs text-muted underline underline-offset-2 hover:text-red-600 dark:hover:text-red-400"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {archived.map((unit, index) => (
            <li key={unit.id} className="flex items-center gap-2 text-sm text-muted">
              <span className="line-through">{unit.label ?? `Exemplaire ${active.length + index + 1}`}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => unarchiveItemUnitAction(itemId, itemSlug, unit.id))}
                className="text-xs underline underline-offset-2 hover:text-ink"
              >
                Réactiver
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const label = newLabel.trim() || null;
          setNewLabel("");
          run(() => addItemUnitAction(itemId, itemSlug, label));
        }}
        className="mt-4 flex items-center gap-2"
      >
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nom de l'exemplaire (optionnel)"
          disabled={pending}
          className="w-48 py-1"
        />
        <Button type="submit" variant="ghost" disabled={pending}>
          Ajouter un exemplaire
        </Button>
      </form>

      {message && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}

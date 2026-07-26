"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { categoryLabel } from "@/core/ui/categories";
import { createProjectAction, type CreateProjectState } from "./actions";

const initialState: CreateProjectState = { status: "idle" };

interface AvailableItem {
  id: string;
  name: string;
  category: string;
  ownerName: string;
}

export function NewProjectForm({ items }: { items: AvailableItem[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom du chantier *" htmlFor="name">
        <Input id="name" name="name" placeholder="Refaire la terrasse" required />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Du *" htmlFor="startDate">
          <Input id="startDate" name="startDate" type="date" required />
        </FormField>
        <FormField label="Au *" htmlFor="endDate">
          <Input id="endDate" name="endDate" type="date" required />
        </FormField>
      </div>
      <FormField label="Message pour les propriétaires (optionnel)" htmlFor="message">
        <Textarea id="message" name="message" rows={2} placeholder="Pour refaire ma terrasse..." />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
          Objets nécessaires *
        </legend>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Aucun objet disponible pour l&apos;instant.</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-line-soft p-2">
            {items.map((it) => (
              <label
                key={it.id}
                className="flex items-center gap-2 rounded-md p-1.5 text-sm text-ink hover:bg-surface"
              >
                <input
                  type="checkbox"
                  name="itemIds"
                  value={it.id}
                  className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
                />
                <span className="flex-1">{it.name}</span>
                <span className="text-xs text-muted">
                  {categoryLabel(it.category)} — {it.ownerName}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Demander le chantier"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Label } from "@/core/ui/components/Field";
import { createEventAction, type CreateEventState } from "../actions";
import type { MemberForEventForm } from "@/modules/caisse/data/events";

const initialState: CreateEventState = { status: "idle" };

export function NewEventForm({
  members,
  currentMemberId,
}: {
  members: MemberForEventForm[];
  currentMemberId: string;
}) {
  const [state, formAction, pending] = useActionState(createEventAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom de l'évènement *" htmlFor="name">
        <Input id="name" name="name" placeholder="Camping en Ardèche" required />
      </FormField>

      <div>
        <Label>Qui participe ?</Label>
        <p className="mt-1 text-xs text-muted">
          Le nombre de parts vient du profil de chacun (« Marine et Arthur » = 2) — ajustable ici pour
          cet évènement précis.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border border-line p-2.5">
              <input
                type="checkbox"
                id={`participant-${m.id}`}
                name={`participant_${m.id}`}
                defaultChecked={m.id === currentMemberId}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor={`participant-${m.id}`} className="flex-1 text-sm text-ink">
                {m.name}
              </label>
              <input
                type="number"
                name={`shares_${m.id}`}
                defaultValue={m.householdSize}
                min={1}
                aria-label={`Parts pour ${m.name}`}
                className="w-16 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm text-ink"
              />
              <span className="text-xs text-muted">part(s)</span>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Création..." : "Créer l'évènement"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

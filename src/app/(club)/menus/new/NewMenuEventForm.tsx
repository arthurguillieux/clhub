"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { createMenuEventAction, type CreateMenuEventState } from "../actions";
import type { CalendarDate } from "@/core/date";

const initialState: CreateMenuEventState = { status: "idle" };

function shortLabel(day: CalendarDate): string {
  const date = new Date(`${day}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function NewMenuEventForm({ suggestedDates }: { suggestedDates: CalendarDate[] }) {
  const [state, formAction, pending] = useActionState(createMenuEventAction, initialState);
  const dateInputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" placeholder="Barbecue de printemps" required />
      </FormField>
      <FormField label="Quand *" htmlFor="eventDate">
        <Input id="eventDate" name="eventDate" type="date" ref={dateInputRef} required />
      </FormField>

      {suggestedDates.length > 0 && (
        <div>
          <p className="text-xs text-muted">
            Jours où tout le monde a connecté son agenda est libre, sur les 30 prochains jours :
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestedDates.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  if (dateInputRef.current) dateInputRef.current.value = day;
                }}
                className="rounded-full border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                {shortLabel(day)}
              </button>
            ))}
          </div>
        </div>
      )}

      <FormField label="Détails (optionnel)" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Chez qui, à quelle heure, thème du repas..."
        />
      </FormField>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Proposer ce repas"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

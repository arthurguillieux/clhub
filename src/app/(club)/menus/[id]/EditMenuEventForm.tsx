"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { updateMenuEventAction, type UpdateMenuEventState } from "../actions";

const initialState: UpdateMenuEventState = { status: "idle" };

export interface EditableMenuEvent {
  title: string;
  description: string | null;
  eventDate: string;
}

export function EditMenuEventForm({ eventId, event }: { eventId: string; event: EditableMenuEvent }) {
  const action = updateMenuEventAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" defaultValue={event.title} required />
      </FormField>
      <FormField label="Quand *" htmlFor="eventDate">
        <Input id="eventDate" name="eventDate" type="date" defaultValue={event.eventDate} required />
      </FormField>
      <FormField label="Détails (optionnel)" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={event.description ?? ""}
          placeholder="Chez qui, à quelle heure, thème du repas..."
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant="accent" className="self-start">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
        {state.status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
        )}
      </div>
    </form>
  );
}

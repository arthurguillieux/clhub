"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { updateClubEventAction, type UpdateClubEventState } from "../actions";

const initialState: UpdateClubEventState = { status: "idle" };

export interface EditableClubEvent {
  title: string;
  eventDate: string;
  description: string | null;
}

export function EditClubEventForm({ eventId, event }: { eventId: string; event: EditableClubEvent }) {
  const action = updateClubEventAction.bind(null, eventId);
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
        <Textarea id="description" name="description" rows={3} defaultValue={event.description ?? ""} />
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

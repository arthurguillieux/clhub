"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { updateEventAction, type UpdateEventState } from "../actions";

const initialState: UpdateEventState = { status: "idle" };

export function EditEventForm({ eventId, name }: { eventId: string; name: string }) {
  const action = updateEventAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom *" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
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

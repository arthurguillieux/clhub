"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { createMenuEventAction, type CreateMenuEventState } from "../actions";

const initialState: CreateMenuEventState = { status: "idle" };

export function NewMenuEventForm() {
  const [state, formAction, pending] = useActionState(createMenuEventAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" placeholder="Barbecue de printemps" required />
      </FormField>
      <FormField label="Quand *" htmlFor="eventDate">
        <Input id="eventDate" name="eventDate" type="date" required />
      </FormField>
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

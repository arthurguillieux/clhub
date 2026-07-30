"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { createClubEventAction, type CreateClubEventState } from "../actions";

const initialState: CreateClubEventState = { status: "idle" };

export function NewClubEventForm() {
  const [state, formAction, pending] = useActionState(createClubEventAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Quoi *" htmlFor="title">
        <Input id="title" name="title" placeholder="10 ans de mariage de Marine et Arthur" required />
      </FormField>
      <FormField label="Quand *" htmlFor="eventDate">
        <Input id="eventDate" name="eventDate" type="date" required />
      </FormField>
      <FormField label="Détails (optionnel)" htmlFor="description">
        <Textarea id="description" name="description" rows={3} placeholder="Où, à quelle heure..." />
      </FormField>

      <p className="text-xs text-muted">
        Purement informatif — ça n&apos;affecte les disponibilités de personne, juste un repère sur
        l&apos;agenda du club.
      </p>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Ajouter à l'agenda"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

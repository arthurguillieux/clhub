"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { submitResponseAction, type SubmitResponseState } from "../actions";

const initialState: SubmitResponseState = { status: "idle" };

export function ResponseForm({
  eventId,
  myResponse,
}: {
  eventId: string;
  myResponse: { attending: boolean; bringing: string | null; allergies: string | null } | null;
}) {
  const action = submitResponseAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="radio"
            name="attending"
            value="yes"
            defaultChecked={myResponse?.attending !== false}
            className="h-4 w-4 text-primary focus:ring-primary"
          />
          Je viens
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="radio"
            name="attending"
            value="no"
            defaultChecked={myResponse?.attending === false}
            className="h-4 w-4 text-primary focus:ring-primary"
          />
          Je ne viens pas
        </label>
      </fieldset>

      <FormField label="J'apporte (optionnel)" htmlFor="bringing">
        <Input
          id="bringing"
          name="bringing"
          placeholder="Une salade, du vin..."
          defaultValue={myResponse?.bringing ?? ""}
        />
      </FormField>
      <FormField label="Allergies / régime (optionnel)" htmlFor="allergies">
        <Input
          id="allergies"
          name="allergies"
          placeholder="Sans gluten, végétarien..."
          defaultValue={myResponse?.allergies ?? ""}
        />
      </FormField>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : myResponse ? "Mettre à jour ma réponse" : "Répondre"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">Réponse enregistrée !</p>
      )}
    </form>
  );
}

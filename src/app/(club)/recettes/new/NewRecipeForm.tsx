"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { createRecipeAction, type CreateRecipeState } from "../actions";

const initialState: CreateRecipeState = { status: "idle" };

export function NewRecipeForm() {
  const [state, formAction, pending] = useActionState(createRecipeAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom de la recette *" htmlFor="title">
        <Input id="title" name="title" placeholder="Tarte aux poireaux de Kazya" required />
      </FormField>
      <FormField label="Ingrédients *" htmlFor="ingredients">
        <Textarea
          id="ingredients"
          name="ingredients"
          rows={5}
          placeholder={"1 pâte brisée\n3 poireaux\n20 cl de crème...\n"}
          required
        />
      </FormField>
      <FormField label="Préparation *" htmlFor="instructions">
        <Textarea
          id="instructions"
          name="instructions"
          rows={8}
          placeholder={"1. Préchauffer le four à 200°C.\n2. ..."}
          required
        />
      </FormField>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Ajouter au carnet"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

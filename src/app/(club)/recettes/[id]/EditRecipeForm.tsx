"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { DIETARY_TAGS, DIETARY_TAG_LABELS, parseDietaryTags } from "@/core/dietaryTags";
import { updateRecipeAction, type UpdateRecipeState } from "../actions";

const initialState: UpdateRecipeState = { status: "idle" };

export interface EditableRecipe {
  title: string;
  equipment: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string;
  instructions: string;
  dietaryTags: unknown;
}

/** Same fields as NewRecipeForm, pre-filled. */
export function EditRecipeForm({ recipeId, recipe }: { recipeId: string; recipe: EditableRecipe }) {
  const action = updateRecipeAction.bind(null, recipeId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const currentTags = parseDietaryTags(recipe.dietaryTags);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom de la recette *" htmlFor="title">
        <Input id="title" name="title" defaultValue={recipe.title} required />
      </FormField>

      <FormField label="Matériel nécessaire (optionnel)" htmlFor="equipment">
        <Input id="equipment" name="equipment" defaultValue={recipe.equipment ?? ""} />
      </FormField>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Personnes" htmlFor="servings">
          <Input id="servings" name="servings" type="number" min={1} max={50} defaultValue={recipe.servings ?? ""} />
        </FormField>
        <FormField label="Préparation (min)" htmlFor="prepMinutes">
          <Input
            id="prepMinutes"
            name="prepMinutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={recipe.prepMinutes ?? ""}
          />
        </FormField>
        <FormField label="Cuisson (min)" htmlFor="cookMinutes">
          <Input
            id="cookMinutes"
            name="cookMinutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={recipe.cookMinutes ?? ""}
          />
        </FormField>
      </div>

      <FormField label="Convient à (optionnel)" htmlFor="dietaryTags">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DIETARY_TAGS.map((tag) => (
            <label
              key={tag}
              htmlFor={`diet-${tag}`}
              className="flex items-center gap-2 rounded-md border border-line p-2 text-sm text-ink"
            >
              <input
                id={`diet-${tag}`}
                type="checkbox"
                name="dietaryTags"
                value={tag}
                defaultChecked={currentTags.includes(tag)}
                className="h-4 w-4 accent-primary"
              />
              {DIETARY_TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="Ingrédients *" htmlFor="ingredients">
        <Textarea id="ingredients" name="ingredients" rows={5} defaultValue={recipe.ingredients} required />
      </FormField>
      <FormField label="Préparation *" htmlFor="instructions">
        <Textarea id="instructions" name="instructions" rows={8} defaultValue={recipe.instructions} required />
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

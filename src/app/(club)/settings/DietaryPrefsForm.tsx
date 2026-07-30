"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Textarea } from "@/core/ui/components/Field";
import { DIETARY_TAGS, DIETARY_TAG_LABELS, parseDietaryTags } from "@/core/dietaryTags";
import { updateDietaryPrefsAction, type DietaryPrefsState } from "./actions";

const initialState: DietaryPrefsState = { status: "idle" };

export function DietaryPrefsForm({
  dietaryTags,
  dietaryNotes,
}: {
  dietaryTags: unknown;
  dietaryNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateDietaryPrefsAction, initialState);
  const current = parseDietaryTags(dietaryTags);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DIETARY_TAGS.map((tag) => (
          <label
            key={tag}
            htmlFor={`diet-${tag}`}
            className="flex items-center gap-2 rounded-md border border-line p-2.5 text-sm text-ink"
          >
            <input
              id={`diet-${tag}`}
              type="checkbox"
              name="dietaryTags"
              value={tag}
              defaultChecked={current.includes(tag)}
              className="h-4 w-4 accent-primary"
            />
            {DIETARY_TAG_LABELS[tag]}
          </label>
        ))}
      </div>

      <FormField label="Autres restrictions / je n'aime pas (optionnel)" htmlFor="dietaryNotes">
        <Textarea
          id="dietaryNotes"
          name="dietaryNotes"
          rows={2}
          placeholder="Ce que la liste ci-dessus ne couvre pas..."
          defaultValue={dietaryNotes ?? ""}
        />
      </FormField>

      <p className="-mt-1 text-xs text-muted">
        Visible par les autres membres quand ils préparent un menu partagé.
      </p>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">Enregistré.</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

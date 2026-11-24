"use client";

import { useActionState } from "react";
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
    <form
      action={formAction}
      // A ticked box saves at once; the free text saves when you leave the field.
      onChange={(e) => {
        if ((e.target as unknown as HTMLInputElement).type === "checkbox") e.currentTarget.requestSubmit();
      }}
      className="flex flex-col gap-3"
    >
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
          onBlur={(e) => {
            if (e.currentTarget.value !== e.currentTarget.defaultValue) e.currentTarget.form?.requestSubmit();
          }}
        />
      </FormField>

      <p className="-mt-1 text-xs text-muted">
        Visible par les autres membres quand ils préparent un potluck.
      </p>

      <p aria-live="polite" className="min-h-5 text-sm">
        {pending ? (
          <span className="text-muted">Enregistrement…</span>
        ) : state.status === "success" ? (
          <span className="text-green-700 dark:text-green-400">Enregistré ✓</span>
        ) : state.status === "error" ? (
          <span className="text-red-600 dark:text-red-400">{state.message}</span>
        ) : null}
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Textarea } from "@/core/ui/components/Field";
import { submitReviewAction, type SubmitReviewState } from "../actions";

const initialState: SubmitReviewState = { status: "idle" };

export function ReviewForm({
  recipeId,
  myReview,
}: {
  recipeId: string;
  myReview: { rating: number; comment: string | null } | null;
}) {
  const action = submitReviewAction.bind(null, recipeId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [rating, setRating] = useState(myReview?.rating ?? 0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-ink">Note</p>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
              className={`text-2xl leading-none ${n <= rating ? "text-primary" : "text-line"}`}
            >
              ★
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>

      <FormField label="Avis (optionnel)" htmlFor="comment">
        <Textarea id="comment" name="comment" rows={3} defaultValue={myReview?.comment ?? ""} />
      </FormField>

      <Button type="submit" disabled={pending || rating === 0} variant="accent" className="self-start">
        {pending ? "Envoi..." : myReview ? "Mettre à jour mon avis" : "Envoyer mon avis"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-primary">Avis enregistré.</p>
      )}
    </form>
  );
}

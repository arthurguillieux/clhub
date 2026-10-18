"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteReviewAction } from "../actions";

export function DeleteReviewButton({ recipeId, memberId }: { recipeId: string; memberId: string }) {
  return (
    <ConfirmDeleteButton
      quiet
      question="Supprimer cet avis ?"
      confirmLabel="Supprimer l'avis"
      keepLabel="Garder l'avis"
      onConfirm={() => deleteReviewAction(recipeId, memberId)}
    />
  );
}

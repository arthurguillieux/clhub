"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteRecipeAction } from "../actions";

export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer la recette « ${title} » et ses avis ?`}
      confirmLabel="Supprimer la recette"
      keepLabel="Garder la recette"
      onConfirm={() => deleteRecipeAction(recipeId)}
    />
  );
}

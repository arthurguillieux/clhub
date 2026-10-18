"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteCommentAction } from "./actions";

export function DeleteCommentButton({
  itemId,
  itemSlug,
  commentId,
}: {
  itemId: string;
  itemSlug: string;
  commentId: string;
}) {
  return (
    <ConfirmDeleteButton
      quiet
      question="Supprimer ce commentaire ?"
      confirmLabel="Supprimer le commentaire"
      keepLabel="Garder le commentaire"
      onConfirm={() => deleteCommentAction(itemId, itemSlug, commentId)}
    />
  );
}

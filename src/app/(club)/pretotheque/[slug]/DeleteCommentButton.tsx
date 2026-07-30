"use client";

import { useState, useTransition } from "react";
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
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted underline underline-offset-2 hover:text-red-600 dark:hover:text-red-400"
      >
        Supprimer
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted">Supprimer ce commentaire ?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteCommentAction(itemId, itemSlug, commentId))}
        className="font-semibold text-red-600 hover:underline dark:text-red-400"
      >
        {pending ? "..." : "Confirmer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted underline underline-offset-2 hover:text-ink"
      >
        Annuler
      </button>
    </span>
  );
}

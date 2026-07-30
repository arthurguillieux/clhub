"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteItemAction } from "../actions";

export function DeleteItemButton({
  itemId,
  name,
  redirectTo,
}: {
  itemId: string;
  name: string;
  /** Set from the item's own detail page — that page 404s once its item is gone, so it must navigate away itself. The /admin/objets list just revalidates in place. */
  redirectTo?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted">Supprimer {name} et son historique de prêt ?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await adminDeleteItemAction(itemId);
            if (redirectTo) router.push(redirectTo);
          })
        }
        className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-red-500"
      >
        {pending ? "..." : "Confirmer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md border border-line px-2 py-1 font-semibold text-ink hover:bg-surface-raised"
      >
        Annuler
      </button>
    </div>
  );
}

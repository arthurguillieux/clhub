"use client";

import { useRouter } from "next/navigation";
import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
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
  const router = useRouter();

  return (
    <ConfirmDeleteButton
      question={`Supprimer l'objet « ${name} » et son historique de prêt ?`}
      confirmLabel="Supprimer l'objet"
      keepLabel="Garder l'objet"
      onConfirm={async () => {
        await adminDeleteItemAction(itemId);
        if (redirectTo) router.push(redirectTo);
      }}
    />
  );
}

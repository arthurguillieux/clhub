"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteListingAction } from "../actions";

export function DeleteListingButton({ listingId, title }: { listingId: string; title: string }) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer l'annonce « ${title} » ?`}
      confirmLabel="Supprimer l'annonce"
      keepLabel="Garder l'annonce"
      onConfirm={() => deleteListingAction(listingId)}
    />
  );
}

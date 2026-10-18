"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteEventAction } from "../actions";

export function DeleteEventButton({ eventId, name }: { eventId: string; name: string }) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer l'évènement « ${name} » avec toutes ses dépenses et ses remboursements ?`}
      confirmLabel="Supprimer l'évènement"
      keepLabel="Garder l'évènement"
      onConfirm={() => deleteEventAction(eventId)}
    />
  );
}

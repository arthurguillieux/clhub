"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteClubEventAction } from "./actions";

export function DeleteClubEventButton({ eventId, title }: { eventId: string; title: string }) {
  return (
    <ConfirmDeleteButton
      quiet
      question={`Supprimer « ${title} » de l'agenda ?`}
      confirmLabel="Supprimer l'évènement"
      keepLabel="Garder l'évènement"
      onConfirm={() => deleteClubEventAction(eventId)}
    />
  );
}

"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteMenuEventAction } from "../actions";

export function DeleteMenuEventButton({ eventId, title }: { eventId: string; title: string }) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer le repas « ${title} » et les réponses reçues ?`}
      confirmLabel="Supprimer le repas"
      keepLabel="Garder le repas"
      onConfirm={() => deleteMenuEventAction(eventId)}
    />
  );
}

"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteKillerGameAction } from "@/app/(killer)/killer/actions";

export function DeleteGameButton({ code, title }: { code: string; title: string }) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer la partie « ${title} » ? Les agents, leurs photos et l'historique sont effacés.`}
      confirmLabel="Supprimer la partie"
      keepLabel="Garder"
      onConfirm={() => deleteKillerGameAction(code)}
    />
  );
}

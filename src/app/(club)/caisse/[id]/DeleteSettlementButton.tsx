"use client";

import { ConfirmDeleteButton } from "@/core/ui/components/ConfirmDeleteButton";
import { deleteSettlementAction } from "../actions";

/** `summary` is the row's own wording (« Kazya → Arthur ») so the question names exactly what's at stake. */
export function DeleteSettlementButton({
  settlementId,
  eventId,
  summary,
}: {
  settlementId: string;
  eventId: string;
  summary: string;
}) {
  return (
    <ConfirmDeleteButton
      question={`Supprimer le remboursement ${summary} ? Les soldes seront recalculés.`}
      confirmLabel="Supprimer le remboursement"
      keepLabel="Garder le remboursement"
      onConfirm={() => deleteSettlementAction(settlementId, eventId)}
    />
  );
}

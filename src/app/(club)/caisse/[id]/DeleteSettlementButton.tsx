"use client";

import { useTransition } from "react";
import { deleteSettlementAction } from "../actions";

export function DeleteSettlementButton({ settlementId, eventId }: { settlementId: string; eventId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => deleteSettlementAction(settlementId, eventId))}
      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
    >
      {pending ? "..." : "Supprimer"}
    </button>
  );
}

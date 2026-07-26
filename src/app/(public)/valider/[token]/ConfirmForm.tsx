"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { confirmAction, type ConfirmState } from "./actions";

const initialState: ConfirmState = { status: "idle" };

export function ConfirmForm({ token, isApprove }: { token: string; isApprove: boolean }) {
  const action = confirmAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "success") {
    return (
      <p className="mt-4 text-sm text-green-700 dark:text-green-400">
        {state.decision === "approved"
          ? "Demande acceptée — l'emprunteur est prévenu."
          : "Demande refusée — l'emprunteur est prévenu."}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <Button type="submit" disabled={pending} variant={isApprove ? "accent" : "ghost"}>
        {pending ? "..." : isApprove ? "Confirmer l'acceptation" : "Confirmer le refus"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

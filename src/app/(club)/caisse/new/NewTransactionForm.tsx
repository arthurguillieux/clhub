"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createTransactionAction, type CreateTransactionState } from "../actions";

const initialState: CreateTransactionState = { status: "idle" };

export function NewTransactionForm() {
  const [state, formAction, pending] = useActionState(createTransactionAction, initialState);
  const [type, setType] = useState<"contribution" | "expense">("contribution");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Type de mouvement" htmlFor="type">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("contribution")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
              type === "contribution"
                ? "border-primary bg-primary/10 text-primary"
                : "border-line text-muted hover:bg-surface"
            }`}
          >
            J&apos;ajoute de l&apos;argent
          </button>
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold ${
              type === "expense"
                ? "border-primary bg-primary/10 text-primary"
                : "border-line text-muted hover:bg-surface"
            }`}
          >
            J&apos;ai payé quelque chose
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
      </FormField>

      <FormField label="Montant (€) *" htmlFor="amount">
        <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="25.00" required />
      </FormField>

      <FormField label="Pour quoi ? *" htmlFor="description">
        <Input
          id="description"
          name="description"
          placeholder={type === "contribution" ? "Cagnotte anniversaire du club" : "Colle et vis pour l'étagère"}
          required
        />
      </FormField>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Enregistrer"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select } from "@/core/ui/components/Field";
import { Card } from "@/core/ui/components/Card";
import { updateExpenseAction, deleteExpenseAction, type UpdateExpenseState } from "../actions";

const initialState: UpdateExpenseState = { status: "idle" };

function euros(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)} €`;
}

export interface ExpenseForRow {
  id: string;
  description: string;
  amountCents: number;
  paidByMemberId: string;
  paidByName: string;
}

export function ExpenseRow({
  eventId,
  expense,
  participants,
  canManage,
  isAdmin,
}: {
  eventId: string;
  expense: ExpenseForRow;
  participants: { memberId: string; name: string }[];
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const action = updateExpenseAction.bind(null, expense.id, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [deletePending, startDeleteTransition] = useTransition();

  // Close the edit form once the action reports success — an update, not a
  // subscription, so it happens during render rather than in an effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "success" && editing) setEditing(false);
  }

  if (editing) {
    return (
      <Card className="p-3">
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Montant (€) *" htmlFor={`amount-${expense.id}`}>
              <Input
                id={`amount-${expense.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={(expense.amountCents / 100).toFixed(2)}
                required
              />
            </FormField>
            <FormField label="Payé par *" htmlFor={`paidBy-${expense.id}`}>
              <Select id={`paidBy-${expense.id}`} name="paidByMemberId" defaultValue={expense.paidByMemberId} required>
                {participants.map((p) => (
                  <option key={p.memberId} value={p.memberId}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Pour quoi ? *" htmlFor={`description-${expense.id}`}>
            <Input id={`description-${expense.id}`} name="description" defaultValue={expense.description} required />
          </FormField>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending} variant="accent" className="self-start">
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-raised"
            >
              Annuler
            </button>
          </div>
          {state.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div>
        <p className="text-sm font-semibold text-ink">{expense.description}</p>
        <p className="text-xs text-muted">Payé par {expense.paidByName}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-mono text-sm font-semibold tabular-nums text-ink">{euros(expense.amountCents)}</p>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Modifier
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={deletePending}
                onClick={() => startDeleteTransition(() => deleteExpenseAction(expense.id, eventId))}
                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                {deletePending ? "..." : "Supprimer"}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

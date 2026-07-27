"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select } from "@/core/ui/components/Field";
import { addExpenseAction, type AddExpenseState } from "../actions";

const initialState: AddExpenseState = { status: "idle" };

export function AddExpenseForm({
  eventId,
  participants,
  currentMemberId,
}: {
  eventId: string;
  participants: { memberId: string; name: string }[];
  currentMemberId: string;
}) {
  const action = addExpenseAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Montant (€) *" htmlFor="amount">
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="25.00" required />
        </FormField>
        <FormField label="Payé par *" htmlFor="paidByMemberId">
          <Select id="paidByMemberId" name="paidByMemberId" defaultValue={currentMemberId} required>
            {participants.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Pour quoi ? *" htmlFor="description">
        <Input id="description" name="description" placeholder="Courses, essence, camping..." required />
      </FormField>

      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Ajouter la dépense"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

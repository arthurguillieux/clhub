"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select } from "@/core/ui/components/Field";
import { recordSettlementAction, type RecordSettlementState } from "../actions";

const initialState: RecordSettlementState = { status: "idle" };

export function RecordSettlementForm({
  eventId,
  participants,
}: {
  eventId: string;
  participants: { memberId: string; name: string }[];
}) {
  const action = recordSettlementAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="De" htmlFor="fromMemberId">
          <Select id="fromMemberId" name="fromMemberId" required>
            {participants.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Vers" htmlFor="toMemberId">
          <Select id="toMemberId" name="toMemberId" required>
            {participants.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Montant (€)" htmlFor="amount">
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="25.00" required />
        </FormField>
      </div>

      <Button type="submit" disabled={pending} variant="ghost" className="self-start">
        {pending ? "Enregistrement..." : "Enregistrer un remboursement"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

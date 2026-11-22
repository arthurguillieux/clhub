"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import { newEveningAction, unlockAction, type FormState } from "@/app/(scenario)/scenario/actions";

const idle: FormState = { status: "idle" };

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function UnlockForm({ scenarioId }: { scenarioId: string }) {
  const [state, action] = useActionState(unlockAction, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="scenario" value={scenarioId} />
      <label className="text-sm font-medium text-ink" htmlFor={`pw-${scenarioId}`}>
        Mot de passe du scénario
      </label>
      <div className="flex flex-wrap gap-2">
        <Input id={`pw-${scenarioId}`} name="password" autoComplete="off" className="max-w-48" />
        <Submit label="Ouvrir le scénario" busy="Vérification…" />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function NewEveningButton({ scenarioId }: { scenarioId: string }) {
  return (
    <form action={newEveningAction.bind(null, scenarioId)}>
      <Submit label="❄️ Préparer une soirée" busy="Création…" />
    </form>
  );
}

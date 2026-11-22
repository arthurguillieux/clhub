"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import { deleteSimulationsAction, newEveningAction, simulateAction, unlockAction, type FormState } from "@/app/(scenario)/scenario/actions";

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

/** Opens the scenario's station: piloted on its own first, the scenario loaded into it later. */
export function NewEveningButton({ scenarioId, baseName }: { scenarioId: string; baseName: string }) {
  return (
    <form action={newEveningAction.bind(null, scenarioId)}>
      <Submit label={`❄️ Ouvrir la ${baseName.charAt(0).toLowerCase()}${baseName.slice(1)}`} busy="Ouverture…" />
    </form>
  );
}

/** « Simuler une partie »: a fictive evening of 20, opened at the chosen moment. Never while a real one is live. */
export function SimulateForm({ scenarioId, starts, blocked }: { scenarioId: string; starts: { id: string; label: string }[]; blocked: boolean }) {
  const [state, action] = useActionState(simulateAction.bind(null, scenarioId), idle);
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-line pt-4">
      <p className="text-sm font-medium text-ink">Simuler une partie</p>
      <p className="text-xs text-muted">20 joueurs fictifs, les cartes tirées, le journal déjà écrit jusqu&apos;au moment choisi. Pour visiter ou répéter.</p>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Commencer à
        <select name="start" defaultValue="b1-arrival" disabled={blocked} className="min-h-11 rounded-md border border-line bg-ground px-3 text-ink">
          {starts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {blocked ? (
        <p className="text-sm text-muted">Une vraie soirée est en cours : la simulation attendra qu&apos;elle soit terminée.</p>
      ) : (
        <div>
          <Submit label="🧪 Simuler une partie" busy="Préparation de la simulation…" />
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DeleteSimulationsButton({ count }: { count: number }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button type="button" variant="ghost" onClick={() => setAsking(true)}>
        Supprimer toutes les simulations
      </Button>
    );
  return (
    <form action={deleteSimulationsAction} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">{count > 1 ? `Les ${count} simulations seront effacées.` : "La simulation sera effacée."}</span>
      <Submit label="Supprimer les simulations" busy="Suppression…" />
      <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
        Les garder
      </Button>
    </form>
  );
}

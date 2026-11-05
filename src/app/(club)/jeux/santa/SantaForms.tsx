"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createSantaAction, joinSantaAction, type FormState } from "@/app/(santa)/santa/actions";

const idle: FormState = { status: "idle" };
const values = (state: FormState) => (state.status === "error" ? (state.values ?? {}) : {});

export function CreateSantaForm() {
  const [state, action, pending] = useActionState(createSantaAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField label="Nom du Secret Santa" htmlFor="title">
        <Input id="title" name="title" placeholder="Noël 2026" maxLength={80} />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="accent" className="self-start" disabled={pending}>
        {pending ? "Création…" : "Organiser un Secret Santa"}
      </Button>
    </form>
  );
}

/** Join someone else's Secret Santa as a co-organizer, with its code and co-organization password. */
export function JoinSantaForm() {
  const [state, action, pending] = useActionState(joinSantaAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
        <FormField label="Code" htmlFor="join-code">
          <Input id="join-code" name="code" autoComplete="off" maxLength={6} placeholder="AB12CD" className="uppercase" defaultValue={values(state).code} />
        </FormField>
        <FormField label="Mot de passe" htmlFor="join-password">
          <Input id="join-password" name="password" autoComplete="off" maxLength={100} />
        </FormField>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="ghost" className="self-start" disabled={pending}>
        {pending ? "Vérification…" : "Co-organiser ce Secret Santa"}
      </Button>
    </form>
  );
}

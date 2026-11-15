"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createLetterAction, joinLetterAction, type FormState } from "@/app/(lettre)/lettre/actions";

const idle: FormState = { status: "idle" };
const values = (state: FormState) => (state.status === "error" ? (state.values ?? {}) : {});

export function CreateLetterForm({ year }: { year: number }) {
  const [state, action, pending] = useActionState(createLetterAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
        <FormField label="Prénom de l'enfant" htmlFor="childName">
          <Input id="childName" name="childName" maxLength={30} autoComplete="off" defaultValue={values(state).childName} />
        </FormField>
        <FormField label="Noël" htmlFor="year">
          <Input id="year" name="year" type="number" inputMode="numeric" min={2020} max={2100} defaultValue={values(state).year ?? year} />
        </FormField>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="accent" className="self-start" disabled={pending}>
        {pending ? "Création…" : "Créer la lettre"}
      </Button>
    </form>
  );
}

/** Join someone else's letter as a co-organizer, with its code and co-organization password. */
export function JoinLetterForm() {
  const [state, action, pending] = useActionState(joinLetterAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
        <FormField label="Code" htmlFor="letter-code">
          <Input id="letter-code" name="code" autoComplete="off" maxLength={6} placeholder="AB12CD" className="uppercase" defaultValue={values(state).code} />
        </FormField>
        <FormField label="Mot de passe" htmlFor="letter-password">
          <Input id="letter-password" name="password" autoComplete="off" maxLength={100} />
        </FormField>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="ghost" className="self-start" disabled={pending}>
        {pending ? "Vérification…" : "Co-organiser cette lettre"}
      </Button>
    </form>
  );
}

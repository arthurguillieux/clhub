"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createKillerGameAction, joinOrganizationAction, type FormState } from "@/app/(killer)/killer/actions";

const idle: FormState = { status: "idle" };
const values = (state: FormState): Record<string, string> => (state.status === "error" ? (state.values ?? {}) : {});

/** A new game: a name, and optionally a password that lets other members co-organize it. */
export function CreateGameForm() {
  const [state, action, pending] = useActionState(createKillerGameAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField label="Nom de la partie" htmlFor="title">
        <Input id="title" name="title" placeholder="Halloween 2026" maxLength={80} defaultValue={values(state).title} />
      </FormField>
      <FormField label="Mot de passe de co-organisation (facultatif)" htmlFor="password">
        <Input
          id="password"
          name="password"
          autoComplete="off"
          maxLength={100}
          placeholder="Laisse vide si tu organises seul·e"
          defaultValue={values(state).password}
        />
      </FormField>
      <p className="-mt-2 text-xs text-muted">
        Tout membre du club qui le connaît pourra co-organiser la partie avec toi : panneau, écran TV, éliminations.
      </p>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="accent" className="self-start" disabled={pending}>
        {pending ? "Création…" : "Préparer une nouvelle partie"}
      </Button>
    </form>
  );
}

/** Join someone else's game as a co-organizer, with its code and co-organization password. */
export function JoinOrganizationForm() {
  const [state, action, pending] = useActionState(joinOrganizationAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
        <FormField label="Code de la partie" htmlFor="join-code">
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
        {pending ? "Vérification…" : "Co-organiser cette partie"}
      </Button>
    </form>
  );
}

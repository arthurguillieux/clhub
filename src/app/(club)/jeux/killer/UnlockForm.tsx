"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { unlockKillerAction, type UnlockState } from "@/app/(killer)/killer/actions";

const initialState: UnlockState = { status: "idle" };

export function UnlockForm() {
  const [state, formAction, pending] = useActionState(unlockKillerAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Mot de passe" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="off" required />
      </FormField>
      <Button type="submit" variant="accent" disabled={pending} className="self-start">
        {pending ? "Vérification…" : "Entrer"}
      </Button>
      {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
    </form>
  );
}

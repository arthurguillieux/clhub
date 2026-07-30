"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { submitInvite, type InviteFormState } from "./actions";

const initialState: InviteFormState = { status: "idle" };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(submitInvite, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Adresse mail à inviter" htmlFor="email">
        <Input id="email" name="email" type="email" required placeholder="pote@example.com" />
      </FormField>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Envoi..." : "Inviter"}
      </Button>

      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          J&apos;espère qu&apos;il sera à la hauteur. Mais d&apos;accord, invitation envoyée.
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

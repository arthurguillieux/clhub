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
        <div className="rounded-md border border-line-soft bg-surface p-3 text-sm">
          <p className="text-green-700 dark:text-green-400">
            Invitation envoyée. Lien (utile tant que Resend n&apos;est pas configuré) :
          </p>
          <code className="mt-1 block break-all font-mono text-xs text-muted">{state.url}</code>
        </div>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

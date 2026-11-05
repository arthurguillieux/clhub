"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createSantaAction, type FormState } from "@/app/(santa)/santa/actions";

const idle: FormState = { status: "idle" };

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

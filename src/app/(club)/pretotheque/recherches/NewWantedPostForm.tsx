"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { createWantedPostAction, type CreateWantedPostState } from "./actions";

const initialState: CreateWantedPostState = { status: "idle" };

export function NewWantedPostForm() {
  const [state, formAction, pending] = useActionState(createWantedPostAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <FormField label="Ce que tu cherches *" htmlFor="title">
        <Input id="title" name="title" placeholder="Décolleuse à papier peint" required />
      </FormField>
      <FormField label="Précisions (optionnel)" htmlFor="description">
        <Textarea id="description" name="description" rows={2} placeholder="Pour le 20, si possible" />
      </FormField>
      <FormField label="Besoin avant le (optionnel)" htmlFor="neededBy">
        <Input id="neededBy" name="neededBy" type="date" />
      </FormField>
      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Envoi..." : "Publier la recherche"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

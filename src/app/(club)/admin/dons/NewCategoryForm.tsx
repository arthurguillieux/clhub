"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input } from "@/core/ui/components/Field";
import { createDonCategoryAction, type CreateCategoryState } from "./actions";

const initialState: CreateCategoryState = { status: "idle" };

export function NewCategoryForm() {
  const [state, formAction, pending] = useActionState(createDonCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div className="flex-1">
        <FormField label="Nouvelle catégorie" htmlFor="name">
          <Input id="name" name="name" placeholder="Vêtements enfants" required />
        </FormField>
      </div>
      <Button type="submit" disabled={pending} variant="accent">
        {pending ? "Ajout..." : "Ajouter"}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

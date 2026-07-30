"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { adminUpdateMemberProfileAction, type AdminUpdateMemberProfileState } from "./actions";

const initialState: AdminUpdateMemberProfileState = { status: "idle" };

export function AdminProfileEditor({
  memberId,
  name,
  bio,
  phone,
  householdSize,
}: {
  memberId: string;
  name: string;
  bio: string | null;
  phone: string | null;
  householdSize: number;
}) {
  const [open, setOpen] = useState(false);
  const action = adminUpdateMemberProfileAction.bind(null, memberId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Modifier le profil (admin)
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <FormField label="Nom d'affichage" htmlFor="admin-name">
        <Input id="admin-name" name="name" defaultValue={name} required />
      </FormField>
      <FormField label="Bio" htmlFor="admin-bio">
        <Textarea id="admin-bio" name="bio" defaultValue={bio ?? ""} rows={2} />
      </FormField>
      <FormField label="Téléphone" htmlFor="admin-phone">
        <Input id="admin-phone" name="phone" type="tel" defaultValue={phone ?? ""} />
      </FormField>
      <FormField label="Nombre de personnes derrière ce profil" htmlFor="admin-household">
        <Input
          id="admin-household"
          name="householdSize"
          type="number"
          min={1}
          max={10}
          defaultValue={householdSize}
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant="accent" className="self-start">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted underline underline-offset-2 hover:text-ink"
        >
          Annuler
        </button>
      </div>
      {state.status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}
      {state.status === "success" && <p className="text-sm text-green-700 dark:text-green-400">Enregistré.</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Textarea } from "@/core/ui/components/Field";
import { updateProfile, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({
  name,
  bio,
  phone,
  householdSize,
}: {
  name: string;
  bio: string | null;
  phone: string | null;
  householdSize: number;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Nom d'affichage" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </FormField>
      <FormField label="Bio" htmlFor="bio">
        <Textarea id="bio" name="bio" defaultValue={bio ?? ""} rows={3} />
      </FormField>
      <FormField label="Téléphone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} />
      </FormField>
      <FormField label="Nombre de personnes derrière ce profil" htmlFor="householdSize">
        <Input
          id="householdSize"
          name="householdSize"
          type="number"
          min={1}
          max={10}
          defaultValue={householdSize}
        />
      </FormField>
      <p className="-mt-2 text-xs text-muted">
        Utilisé pour répartir les dépenses de la Caisse commune — un profil partagé comme « Marine et
        Arthur » compte pour 2.
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </Button>
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">Enregistré.</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

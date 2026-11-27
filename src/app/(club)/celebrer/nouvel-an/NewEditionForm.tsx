"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select } from "@/core/ui/components/Field";
import { createEditionAction, type NewEditionState } from "./actions";

const initial: NewEditionState = { status: "idle" };

/** A new New Year: its title and dates, from scratch or from a previous one (same guests, same habits). */
export function NewEditionForm({ defaults, previous }: { defaults: { title: string; startsOn: string; endsOn: string }; previous: { code: string; title: string }[] }) {
  const [state, action, pending] = useActionState(createEditionAction, initial);
  const [from, setFrom] = useState(previous[0]?.code ?? "");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormField label="Titre" htmlFor="nye-title">
        <Input id="nye-title" name="title" defaultValue={defaults.title} maxLength={80} required />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Du" htmlFor="nye-from">
          <Input id="nye-from" name="startsOn" type="date" defaultValue={defaults.startsOn} required />
        </FormField>
        <FormField label="Au" htmlFor="nye-to">
          <Input id="nye-to" name="endsOn" type="date" defaultValue={defaults.endsOn} required />
        </FormField>
      </div>
      <FormField label="À partir de" htmlFor="nye-copy">
        <Select id="nye-copy" name="from" value={from} onChange={(e) => setFrom(e.target.value)}>
          {previous.map((p) => (
            <option key={p.code} value={p.code}>
              {p.title} : les mêmes invités, missions, listes et budget
            </option>
          ))}
          <option value="">Rien : la liste de départ (boissons, courses, missions)</option>
        </Select>
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Création…" : "Préparer ce nouvel an"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Button } from "@/core/ui/components/Button";
import { FormField, Input, Select, Textarea } from "@/core/ui/components/Field";
import { createBirthdayAction, type NewBirthdayState } from "../actions";

const initial: NewBirthdayState = { status: "idle" };

/** Who we celebrate (a member, hidden from them, or anyone by first name), when, and who's in on it. */
export function NewBirthdayForm({ members }: { members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createBirthdayAction, initial);
  const [who, setWho] = useState<"member" | "other">("member");
  const [honoreeId, setHonoreeId] = useState("");
  const honoree = members.find((m) => m.id === honoreeId);
  const invitable = members.filter((m) => !(who === "member" && m.id === honoreeId));

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-ink">On fête qui ?</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["member", "Un membre du club"],
              ["other", "Quelqu'un d'autre"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium ${who === value ? "border-primary bg-primary/10 text-ink" : "border-line text-muted"}`}>
              <input type="radio" name="who" value={value} checked={who === value} onChange={() => setWho(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        {who === "member" ? (
          <>
            <Select aria-label="Le membre qu'on fête" name="honoreeMemberId" value={honoreeId} onChange={(e) => setHonoreeId(e.target.value)} required>
              <option value="">Choisir…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <input type="hidden" name="honoreeMemberName" value={honoree?.name ?? ""} />
            <p className="text-sm text-muted">
              {honoree ? `${honoree.name} ne verra rien : ni cette page, ni les notifications, ni les mails.` : "La personne fêtée ne verra rien : ni cette page, ni les notifications, ni les mails."}
            </p>
          </>
        ) : (
          <Input aria-label="Prénom de la personne qu'on fête" name="honoreeName" placeholder="Prénom" maxLength={60} required />
        )}
      </fieldset>

      <FormField label="La date de l'anniversaire" htmlFor="eventDate">
        <Input id="eventDate" name="eventDate" type="date" required className="sm:max-w-xs" />
      </FormField>

      <FormField label="Un mot pour les autres (facultatif)" htmlFor="note">
        <Textarea id="note" name="note" rows={2} maxLength={500} placeholder="On vise 20 € chacun, et on le lui offre au resto samedi." />
      </FormField>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Qui on met dans la confidence ?</legend>
        <p className="mt-1 text-sm text-muted">Ils recevront une notification. Tu pourras en ajouter d&apos;autres plus tard.</p>
        {invitable.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Personne d&apos;autre au club pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {invitable.map((m) => (
              <li key={m.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                  <input type="checkbox" name="invitees" value={m.id} className="h-5 w-5 accent-primary" />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} variant="accent" className="self-start">
        {pending ? "Création…" : "Préparer l'anniversaire"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import { updatePersonalCalendarUrl, type PersonalCalendarState } from "./actions";

const initialState: PersonalCalendarState = { status: "idle" };

export function PersonalCalendarForm({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState(updatePersonalCalendarUrl, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Colle l&apos;adresse secrète au format iCal de ton agenda (Google, Outlook, Apple
        Calendar...). Le club ne voit que tes créneaux occupés — jamais le titre, le lieu
        ou le contenu de tes événements.
      </p>
      <Input
        name="personalCalendarUrl"
        type="url"
        placeholder="https://calendar.google.com/calendar/ical/..."
        defaultValue={currentUrl ?? ""}
      />
      <Button type="submit" disabled={pending} variant="ghost" className="self-start">
        {pending ? "Vérification..." : "Enregistrer"}
      </Button>
      {state.status === "success" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {state.eventsFound
            ? "Agenda connecté — des événements ont bien été trouvés."
            : "Agenda connecté — aucun événement dans les deux prochaines semaines pour l'instant."}
        </p>
      )}
      {state.status === "removed" && <p className="text-sm text-muted">Agenda déconnecté.</p>}
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}

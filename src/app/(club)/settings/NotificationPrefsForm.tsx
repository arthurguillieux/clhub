"use client";

import { useActionState } from "react";
import { Button } from "@/core/ui/components/Button";
import { NOTIFICATION_CATEGORIES, wantsEmail } from "@/core/notifications/preferences";
import { updateNotifPrefsAction, type NotifPrefsState } from "./actions";

const initialState: NotifPrefsState = { status: "idle" };

export function NotificationPrefsForm({ notifPrefs }: { notifPrefs: unknown }) {
  const [state, formAction, pending] = useActionState(updateNotifPrefsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {NOTIFICATION_CATEGORIES.map((category) => (
        <label
          key={category.key}
          htmlFor={`notif-${category.key}`}
          className="flex items-start gap-3 rounded-md border border-line p-3"
        >
          <input
            id={`notif-${category.key}`}
            type="checkbox"
            name={category.key}
            defaultChecked={wantsEmail(notifPrefs, category.key)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{category.label}</span>
            <span className="block text-xs text-muted">{category.description}</span>
          </span>
        </label>
      ))}

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
